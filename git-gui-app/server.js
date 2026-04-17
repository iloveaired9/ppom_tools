const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = 3000;
const CONFIG_FILE = path.join(__dirname, 'config', 'repo-config.json');
const CONFIG_DIR = path.join(__dirname, 'config');

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Utility functions
function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return { repositoryPath: '', lastUpdated: null };
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { repositoryPath: '', lastUpdated: null };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function validateRepoPath(repoPath) {
  try {
    // 경로 정규화 (백슬래시와 포워드 슬래시 모두 처리)
    let normalizedPath = repoPath.trim().replace(/\//g, path.sep);
    const absPath = path.resolve(normalizedPath);

    console.log(`[DEBUG] 입력 경로: ${repoPath}`);
    console.log(`[DEBUG] 정규화된 경로: ${absPath}`);
    console.log(`[DEBUG] 경로 존재 여부: ${fs.existsSync(absPath)}`);

    if (!fs.existsSync(absPath)) {
      return { valid: false, error: `경로가 존재하지 않습니다: ${absPath}` };
    }

    const gitPath = path.join(absPath, '.git');
    console.log(`[DEBUG] .git 경로: ${gitPath}`);
    console.log(`[DEBUG] .git 존재 여부: ${fs.existsSync(gitPath)}`);

    if (!fs.existsSync(gitPath)) {
      return { valid: false, error: `Git 저장소가 아닙니다. .git 폴더를 찾을 수 없습니다: ${gitPath}` };
    }

    return { valid: true, path: absPath };
  } catch (err) {
    return { valid: false, error: '경로 검증 실패: ' + err.message };
  }
}

function executeGitCommand(repoPath, command) {
  try {
    const absPath = path.resolve(repoPath);
    // stderr를 무시하고 stdout만 캡처
    const result = execSync(`cd "${absPath}" && ${command} 2>&1`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, result };
  } catch (err) {
    // execSync가 실패해도 stdout 내용이 있을 수 있음
    const result = err.stdout ? err.stdout.toString() : '';
    return {
      success: false,
      error: err.message,
      result: result
    };
  }
}

// API Routes

// Configure repository
app.post('/api/configure', (req, res) => {
  const { repositoryPath } = req.body;

  if (!repositoryPath) {
    return res.status(400).json({ error: '저장소 경로를 입력하세요' });
  }

  const validation = validateRepoPath(repositoryPath);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  const config = {
    repositoryPath: validation.path,
    lastUpdated: new Date().toISOString()
  };

  saveConfig(config);
  res.json({ success: true, config });
});

// Get repository status
app.get('/api/status', (req, res) => {
  const config = getConfig();

  if (!config.repositoryPath) {
    return res.status(400).json({ error: '저장소가 설정되지 않았습니다' });
  }

  const validation = validateRepoPath(config.repositoryPath);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const branchResult = executeGitCommand(validation.path, 'git rev-parse --abbrev-ref HEAD');
    const branch = branchResult.success ? branchResult.result.trim() : 'unknown';

    const statusResult = executeGitCommand(validation.path, 'git status --porcelain');
    const status = statusResult.success ? statusResult.result : '';
    const modified = status.split('\n').filter(line => line.startsWith(' M')).length;
    const untracked = status.split('\n').filter(line => line.startsWith('??')).length;
    const staged = status.split('\n').filter(line => line.startsWith('A ')).length;

    // Upstream 구성이 없을 수 있으므로 먼저 확인
    let behind = 0;
    let aheadCount = 0;

    try {
      const upstreamCheck = execSync(
        `cd "${validation.path}" && git rev-parse @{u} 2>&1`,
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
      );

      if (upstreamCheck.trim()) {
        // Upstream이 설정되어 있으면 차이 조회
        const aheadResult = executeGitCommand(
          validation.path,
          'git rev-list --left-right --count @{u}...HEAD'
        );
        if (aheadResult.success) {
          const ahead = aheadResult.result.trim();
          if (ahead) {
            const parts = ahead.split('\t');
            behind = parseInt(parts[0]) || 0;
            aheadCount = parseInt(parts[1]) || 0;
          }
        }
      }
    } catch (err) {
      // Upstream이 없으면 무시 (behind = 0, ahead = 0)
    }

    res.json({
      branch,
      modified: parseInt(modified),
      untracked: parseInt(untracked),
      staged: parseInt(staged),
      behind: behind,
      ahead: aheadCount
    });
  } catch (err) {
    res.status(500).json({ error: 'Git 상태 조회 실패: ' + err.message });
  }
});

// Get commit history
app.get('/api/commits', (req, res) => {
  const config = getConfig();
  const maxCount = req.query.max || 50;

  if (!config.repositoryPath) {
    return res.status(400).json({ error: '저장소가 설정되지 않았습니다' });
  }

  try {
    const format = '%H%n%an%n%ae%n%ai%n%s%n---';
    const result = executeGitCommand(
      config.repositoryPath,
      `git log -${maxCount} --format="${format}"`
    );

    if (!result.success) {
      return res.status(500).json({ error: '커밋 히스토리 조회 실패' });
    }

    const commits = [];
    const parts = result.result.split('---\n').filter(p => p.trim());

    for (const part of parts) {
      const lines = part.trim().split('\n');
      if (lines.length >= 5) {
        commits.push({
          hash: lines[0],
          author: lines[1],
          email: lines[2],
          date: lines[3],
          message: lines.slice(4).join('\n').trim()
        });
      }
    }

    res.json({ commits });
  } catch (err) {
    res.status(500).json({ error: '커밋 조회 실패: ' + err.message });
  }
});

// Get branches
app.get('/api/branches', (req, res) => {
  const config = getConfig();

  if (!config.repositoryPath) {
    return res.status(400).json({ error: '저장소가 설정되지 않았습니다' });
  }

  try {
    const result = executeGitCommand(config.repositoryPath, 'git branch -a');
    if (!result.success) {
      return res.status(500).json({ error: '브랜치 조회 실패' });
    }

    const branches = result.result
      .split('\n')
      .map(b => b.trim())
      .filter(b => b.length > 0)
      .map(b => ({
        name: b.replace(/^\*\s+/, '').replace(/^remotes\//, ''),
        current: b.startsWith('*')
      }));

    res.json({ branches });
  } catch (err) {
    res.status(500).json({ error: '브랜치 조회 실패: ' + err.message });
  }
});

// Get file diff
app.get('/api/diff/:file/:commit1/:commit2', (req, res) => {
  const config = getConfig();
  const { file, commit1, commit2 } = req.params;

  if (!config.repositoryPath) {
    return res.status(400).json({ error: '저장소가 설정되지 않았습니다' });
  }

  try {
    const result = executeGitCommand(
      config.repositoryPath,
      `git diff ${commit1}..${commit2} -- "${file}"`
    );

    if (!result.success) {
      return res.status(500).json({ error: 'Diff 조회 실패' });
    }

    res.json({ diff: result.result });
  } catch (err) {
    res.status(500).json({ error: 'Diff 조회 실패: ' + err.message });
  }
});

// Switch branch
app.post('/api/switch-branch', (req, res) => {
  const config = getConfig();
  const { branch } = req.body;

  if (!config.repositoryPath || !branch) {
    return res.status(400).json({ error: '저장소 또는 브랜치가 설정되지 않았습니다' });
  }

  try {
    const result = executeGitCommand(config.repositoryPath, `git checkout "${branch}"`);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: `${branch}로 전환되었습니다` });
  } catch (err) {
    res.status(500).json({ error: '브랜치 전환 실패: ' + err.message });
  }
});

// Revert file
app.post('/api/revert', (req, res) => {
  const config = getConfig();
  const { file, commit } = req.body;

  if (!config.repositoryPath || !file) {
    return res.status(400).json({ error: '저장소 또는 파일이 설정되지 않았습니다' });
  }

  try {
    const command = commit
      ? `git checkout ${commit} -- "${file}"`
      : `git checkout HEAD -- "${file}"`;

    const result = executeGitCommand(config.repositoryPath, command);
    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, message: `${file}이(가) 복원되었습니다` });
  } catch (err) {
    res.status(500).json({ error: '파일 복원 실패: ' + err.message });
  }
});

// Get current config
app.get('/api/config', (req, res) => {
  const config = getConfig();
  res.json(config);
});

// Get file list by type
app.get('/api/git-files', (req, res) => {
  const config = getConfig();
  const type = req.query.type || 'modified';

  if (!config.repositoryPath) {
    return res.status(400).json({ error: '저장소가 설정되지 않았습니다' });
  }

  try {
    const result = executeGitCommand(config.repositoryPath, 'git status --porcelain');
    if (!result.success) {
      return res.status(500).json({ error: '파일 목록 조회 실패' });
    }

    const lines = result.result.split('\n').filter(line => line.trim());
    const files = [];

    for (const line of lines) {
      let matches = false;
      let file = '';

      if (type === 'modified' && line.startsWith(' M')) {
        matches = true;
        file = line.substring(3);
      } else if (type === 'untracked' && line.startsWith('??')) {
        matches = true;
        file = line.substring(3);
      } else if (type === 'staged' && (line.startsWith('A ') || line.startsWith('M '))) {
        matches = true;
        file = line.substring(3);
      }

      if (matches && file.trim()) {
        files.push(file.trim());
      }
    }

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: '파일 조회 실패: ' + err.message });
  }
});

// Get file history (commits that modified this file)
app.get('/api/file-history', (req, res) => {
  const config = getConfig();
  const file = req.query.file;

  if (!config.repositoryPath || !file) {
    return res.status(400).json({ error: '저장소 또는 파일이 지정되지 않았습니다' });
  }

  try {
    const format = '%H%n%an%n%ae%n%ai%n%s%n---';
    const result = executeGitCommand(
      config.repositoryPath,
      `git log --follow --format="${format}" -- "${file}"`
    );

    if (!result.success) {
      return res.status(500).json({ error: '히스토리 조회 실패' });
    }

    const commits = [];
    const parts = result.result.split('---\n').filter(p => p.trim());

    for (const part of parts) {
      const lines = part.trim().split('\n');
      if (lines.length >= 5) {
        commits.push({
          hash: lines[0],
          author: lines[1],
          email: lines[2],
          date: lines[3],
          message: lines.slice(4).join('\n').trim()
        });
      }
    }

    res.json({ commits });
  } catch (err) {
    res.status(500).json({ error: '히스토리 조회 실패: ' + err.message });
  }
});

// Get file diff between two commits
app.get('/api/file-diff', (req, res) => {
  const config = getConfig();
  const file = req.query.file;
  const commit1 = req.query.commit1;
  const commit2 = req.query.commit2;

  if (!config.repositoryPath || !file || !commit1 || !commit2) {
    return res.status(400).json({ error: '필수 파라미터가 부족합니다' });
  }

  try {
    const result = executeGitCommand(
      config.repositoryPath,
      `git diff ${commit1}..${commit2} -- "${file}"`
    );

    if (!result.success) {
      // 차이가 없을 수도 있으므로 빈 결과도 성공으로 처리
      return res.json({ diff: '(차이 없음)' });
    }

    res.json({ diff: result.result || '(차이 없음)' });
  } catch (err) {
    res.status(500).json({ error: 'Diff 조회 실패: ' + err.message });
  }
});

// Get files changed in a specific commit
app.get('/api/commit-files', (req, res) => {
  const config = getConfig();
  const hash = req.query.hash;

  if (!config.repositoryPath || !hash) {
    return res.status(400).json({ error: '저장소 또는 커밋이 지정되지 않았습니다' });
  }

  try {
    const result = executeGitCommand(
      config.repositoryPath,
      `git diff-tree --no-commit-id --name-status -r ${hash}`
    );

    if (!result.success) {
      return res.status(500).json({ error: '파일 목록 조회 실패' });
    }

    const files = [];
    const lines = result.result.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        files.push({
          status: getStatusLabel(parts[0]),
          path: parts.slice(1).join(' ')
        });
      }
    }

    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: '파일 목록 조회 실패: ' + err.message });
  }
});

function getStatusLabel(code) {
  const labels = {
    'A': '추가',
    'M': '수정',
    'D': '삭제',
    'R': '이름변경',
    'C': '복사',
    'T': '타입변경'
  };
  return labels[code] || code;
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: '서버 오류가 발생했습니다' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Git GUI 서버가 http://localhost:${PORT}에서 실행 중입니다`);
  console.log('브라우저에서 접속하려면: http://localhost:3000');
});
