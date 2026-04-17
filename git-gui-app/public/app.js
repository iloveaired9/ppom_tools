// Global state
let currentRepoPath = '';
let autoRefreshInterval = null;
let currentFiles = {
  modified: [],
  untracked: [],
  staged: []
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setAutoRefresh();
});

// Configuration
async function configureRepo() {
  const repoPath = document.getElementById('repoPath').value.trim();

  if (!repoPath) {
    showMessage('configMessage', '저장소 경로를 입력하세요', 'error');
    return;
  }

  try {
    const response = await fetch('/api/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repositoryPath: repoPath })
    });

    const data = await response.json();

    if (response.ok) {
      currentRepoPath = data.config.repositoryPath;
      showMessage('configMessage', '✓ 저장소가 성공적으로 로드되었습니다', 'success');
      refreshStatus();
      loadCommits();
      loadBranches();
    } else {
      showMessage('configMessage', '✗ 오류: ' + data.error, 'error');
    }
  } catch (err) {
    showMessage('configMessage', '✗ 연결 실패: ' + err.message, 'error');
  }
}

async function loadConfig() {
  try {
    const response = await fetch('/api/config');
    const config = await response.json();

    if (config.repositoryPath) {
      currentRepoPath = config.repositoryPath;
      document.getElementById('repoPath').value = config.repositoryPath;
      refreshStatus();
      loadCommits();
      loadBranches();
    }
  } catch (err) {
    console.error('설정 로드 실패:', err);
  }
}

// Status
async function refreshStatus() {
  if (!currentRepoPath) {
    showMessage('configMessage', '먼저 저장소를 설정하세요', 'error');
    return;
  }

  try {
    const response = await fetch('/api/status');
    const data = await response.json();

    if (response.ok) {
      document.getElementById('currentBranch').textContent = data.branch || '-';
      document.getElementById('modifiedCount').textContent = data.modified || 0;
      document.getElementById('untrackedCount').textContent = data.untracked || 0;
      document.getElementById('stagedCount').textContent = data.staged || 0;
      document.getElementById('behind').textContent = data.behind || 0;
      document.getElementById('ahead').textContent = data.ahead || 0;
    } else {
      console.error('상태 조회 실패:', data.error);
    }
  } catch (err) {
    console.error('상태 조회 오류:', err);
  }
}

// Commits
async function loadCommits() {
  if (!currentRepoPath) return;

  const commitsList = document.getElementById('commitsList');
  commitsList.innerHTML = '<p class="loading">커밋 로드 중...</p>';

  try {
    const response = await fetch('/api/commits?max=50');
    const data = await response.json();

    if (response.ok && data.commits.length > 0) {
      commitsList.innerHTML = data.commits.map((commit, idx) => `
        <div class="commit-item" onclick="showCommitDetail('${commit.hash}', '${commit.author}', '${commit.email}', '${commit.date}', \`${escapeHtml(commit.message)}\`)">
          <div class="commit-hash">${commit.hash.substring(0, 7)}</div>
          <div class="commit-author">${commit.author} &lt;${commit.email}&gt;</div>
          <div class="commit-message">${escapeHtml(commit.message)}</div>
          <div class="commit-date">${new Date(commit.date).toLocaleString('ko-KR')}</div>
        </div>
      `).join('');
    } else {
      commitsList.innerHTML = '<p class="loading">커밋이 없습니다</p>';
    }
  } catch (err) {
    commitsList.innerHTML = '<p class="loading">커밋 로드 실패</p>';
  }
}

// Commit Detail
function showCommitDetail(hash, author, email, date, message) {
  document.getElementById('commitsListContainer').style.display = 'none';
  document.getElementById('commitDetailContainer').style.display = 'block';

  document.getElementById('detailCommitHash').textContent = hash.substring(0, 12) + '...';
  document.getElementById('detailAuthor').textContent = `${author} <${email}>`;
  document.getElementById('detailDate').textContent = new Date(date).toLocaleString('ko-KR');
  document.getElementById('detailMessage').textContent = message;

  loadCommitFiles(hash);
}

function hideCommitDetail() {
  document.getElementById('commitDetailContainer').style.display = 'none';
  document.getElementById('commitsListContainer').style.display = 'block';
}

async function loadCommitFiles(hash) {
  const filesList = document.getElementById('commitFilesList');
  filesList.innerHTML = '<p class="loading">파일 로드 중...</p>';

  try {
    const response = await fetch(`/api/commit-files?hash=${hash}`);
    const data = await response.json();

    if (response.ok && data.files && data.files.length > 0) {
      filesList.innerHTML = data.files.map(file => `
        <div class="file-item modified" onclick="compareCommitFile('${hash}', '${file.path.replace(/'/g, "\\'")}')">
          <span>${escapeHtml(file.path)}</span>
          <span class="file-status modified">${file.status}</span>
        </div>
      `).join('');
    } else {
      filesList.innerHTML = '<p class="loading">변경된 파일이 없습니다</p>';
    }
  } catch (err) {
    filesList.innerHTML = '<p class="loading">파일 로드 실패</p>';
  }
}

function compareCommitFile(hash, filePath) {
  // 이 커밋과 이전 커밋 비교
  const commit2 = hash;
  const commit1 = hash + '~1'; // 이전 커밋

  document.getElementById('selectedFileName').textContent = filePath;
  document.getElementById('diffCommit1').value = commit1;
  document.getElementById('diffCommit2').value = commit2;

  showSection('files');
  document.getElementById('fileListContainer').style.display = 'none';
  document.getElementById('fileHistoryContainer').style.display = 'none';
  document.getElementById('fileDiffContainer').style.display = 'block';

  setTimeout(() => showFileDiff(), 300);
}

// Branches
async function loadBranches() {
  if (!currentRepoPath) return;

  const branchesList = document.getElementById('branchesList');
  branchesList.innerHTML = '<p class="loading">브랜치 로드 중...</p>';

  try {
    const response = await fetch('/api/branches');
    const data = await response.json();

    if (response.ok && data.branches.length > 0) {
      branchesList.innerHTML = data.branches.map(branch => `
        <div class="branch-item">
          <span class="branch-name">${branch.name}</span>
          ${branch.current ? '<span class="branch-current">현재</span>' : ''}
          ${!branch.current ? `<button class="btn btn-primary branch-btn" onclick="switchBranch('${branch.name}')">전환</button>` : ''}
        </div>
      `).join('');
    } else {
      branchesList.innerHTML = '<p class="loading">브랜치가 없습니다</p>';
    }
  } catch (err) {
    branchesList.innerHTML = '<p class="loading">브랜치 로드 실패</p>';
  }
}

async function switchBranch(branchName) {
  if (!confirm(`${branchName} 브랜치로 전환하시겠습니까?`)) return;

  try {
    const response = await fetch('/api/switch-branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branch: branchName })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('configMessage', '✓ ' + data.message, 'success');
      refreshStatus();
      loadCommits();
    } else {
      showMessage('configMessage', '✗ 오류: ' + data.error, 'error');
    }
  } catch (err) {
    showMessage('configMessage', '✗ 연결 실패', 'error');
  }
}

// File Operations
async function revertFile() {
  const fileName = document.getElementById('fileName').value.trim();

  if (!fileName) {
    showMessage('fileMessage', '파일명을 입력하세요', 'error');
    return;
  }

  if (!confirm(`파일 "${fileName}"을(를) 복원하시겠습니까? 현재 변경사항이 손실됩니다.`)) {
    return;
  }

  try {
    const response = await fetch('/api/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('fileMessage', '✓ ' + data.message, 'success');
      document.getElementById('fileName').value = '';
      refreshStatus();
    } else {
      showMessage('fileMessage', '✗ 오류: ' + data.error, 'error');
    }
  } catch (err) {
    showMessage('fileMessage', '✗ 연결 실패', 'error');
  }
}

// UI Helpers
function showSection(sectionId) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(sectionId).classList.add('active');
  event.target.classList.add('active');
}

function showMessage(elementId, message, type) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `message show ${type}`;

  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

function showCommitDetails(index) {
  const commitsList = document.getElementById('commitsList');
  const commits = commitsList.querySelectorAll('.commit-item');

  if (commits[index]) {
    const detail = commits[index].querySelector('.commit-message').textContent;
    showModal('diffModal', detail);
  }
}

function showModal(modalId, content) {
  const modal = document.getElementById(modalId);
  if (modalId === 'diffModal') {
    document.getElementById('diffContent').textContent = content;
  }
  modal.classList.add('show');
}

function closeDiffModal() {
  document.getElementById('diffModal').classList.remove('show');
}

function setAutoRefresh() {
  autoRefreshInterval = setInterval(() => {
    if (currentRepoPath) {
      refreshStatus();
    }
  }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// File List Management
async function loadFileStatus() {
  if (!currentRepoPath) return;

  try {
    const response = await fetch('/api/status');
    const data = await response.json();

    if (response.ok) {
      // Git status를 통해 파일 목록 조회
      const statusResponse = await fetch('/api/file-list');
      if (statusResponse.ok) {
        const fileData = await statusResponse.json();
        currentFiles = fileData;
      }
    }
  } catch (err) {
    console.error('파일 상태 조회 실패:', err);
  }
}

function showFileList(type) {
  if (!currentRepoPath) {
    alert('먼저 저장소를 설정하세요');
    return;
  }

  const typeLabels = {
    modified: '수정된 파일',
    untracked: '추적되지 않은 파일',
    staged: '스테이징된 파일'
  };

  showSection('files');
  displayFileList(type, typeLabels[type]);
}

function displayFileList(type, title) {
  const container = document.getElementById('fileListContainer');
  const listTitle = document.getElementById('fileListTitle');
  const fileList = document.getElementById('fileList');

  listTitle.textContent = title;

  // git status --porcelain에서 파일 정보 가져오기
  fetch('/api/status')
    .then(res => res.json())
    .then(data => {
      // 실제로는 git status 결과를 파싱해야 함
      // 여기서는 임시로 파일 목록을 표시
      loadDetailedFileList(type, fileList);
      container.style.display = 'block';
      document.getElementById('fileOpsContainer').style.display = 'none';
    })
    .catch(err => {
      console.error('파일 목록 조회 실패:', err);
      fileList.innerHTML = '<p class="loading">파일 목록을 조회할 수 없습니다</p>';
      container.style.display = 'block';
    });
}

function loadDetailedFileList(type, container) {
  if (!currentRepoPath) return;

  container.innerHTML = '<p class="loading">파일 로드 중...</p>';

  // 실제로는 git status --porcelain을 파싱해서 표시
  // 여기서는 간단하게 표시
  const typeMap = {
    modified: { label: '수정됨', prefix: ' M' },
    untracked: { label: '추적 안됨', prefix: '??' },
    staged: { label: '스테이징됨', prefix: 'A ' }
  };

  const typeInfo = typeMap[type];
  if (!typeInfo) return;

  // Git status를 통해 파일 조회
  fetch('/api/git-files?type=' + type)
    .then(res => res.json())
    .then(data => {
      if (data.files && data.files.length > 0) {
        container.innerHTML = data.files.map(file => `
          <div class="file-item ${type}" onclick="showFileHistory('${file.replace(/'/g, "\\'")}')" style="cursor: pointer;">
            <span>${escapeHtml(file)}</span>
            <span class="file-status ${type}">${typeInfo.label}</span>
          </div>
        `).join('');
      } else {
        container.innerHTML = `<p class="loading">파일이 없습니다</p>`;
      }
    })
    .catch(err => {
      console.error('파일 조회 오류:', err);
      container.innerHTML = '<p class="loading">파일 조회 실패</p>';
    });
}

function hideFileList() {
  document.getElementById('fileListContainer').style.display = 'none';
  document.getElementById('fileOpsContainer').style.display = 'block';
}

// File History - Search
function searchFileHistory() {
  const fileName = document.getElementById('searchFileName').value.trim();

  if (!fileName) {
    showMessage('configMessage', '파일 경로를 입력하세요', 'error');
    return;
  }

  if (!currentRepoPath) {
    showMessage('configMessage', '먼저 저장소를 설정하세요', 'error');
    return;
  }

  showFileHistory(fileName);
  document.getElementById('searchFileName').value = '';
}

// File History
function showFileHistory(fileName) {
  if (!currentRepoPath) return;

  document.getElementById('selectedFileName').textContent = fileName;
  document.getElementById('fileListContainer').style.display = 'none';
  document.getElementById('fileHistoryContainer').style.display = 'block';

  loadFileHistory(fileName);
}

function loadFileHistory(fileName) {
  const historyContainer = document.getElementById('fileHistory');
  historyContainer.innerHTML = '<p class="loading">히스토리 로드 중...</p>';

  fetch(`/api/file-history?file=${encodeURIComponent(fileName)}`)
    .then(res => res.json())
    .then(data => {
      if (data.commits && data.commits.length > 0) {
        historyContainer.innerHTML = data.commits.map((commit, idx) => `
          <div class="commit-item" style="cursor: pointer;" onclick="selectCommit('${commit.hash}', ${idx})">
            <div class="commit-hash">${commit.hash.substring(0, 7)}</div>
            <div class="commit-author">${commit.author}</div>
            <div class="commit-message">${escapeHtml(commit.message)}</div>
            <div class="commit-date">${new Date(commit.date).toLocaleString('ko-KR')}</div>
          </div>
        `).join('');
      } else {
        historyContainer.innerHTML = '<p class="loading">히스토리가 없습니다</p>';
      }
    })
    .catch(err => {
      console.error('히스토리 로드 실패:', err);
      historyContainer.innerHTML = '<p class="loading">히스토리 로드 실패</p>';
    });
}

function hideFileHistory() {
  document.getElementById('fileHistoryContainer').style.display = 'none';
  document.getElementById('fileListContainer').style.display = 'block';
}

// Commit Selection for Diff
let selectedCommits = [];

function selectCommit(hash, idx) {
  const fileName = document.getElementById('selectedFileName').textContent;

  if (selectedCommits.length === 0) {
    selectedCommits.push(hash);
    showMessage('configMessage', `첫 번째 버전 선택됨: ${hash.substring(0, 7)}`, 'success');
  } else if (selectedCommits.length === 1) {
    selectedCommits.push(hash);
    showMessage('configMessage', `두 번째 버전 선택됨: ${hash.substring(0, 7)}, 이제 비교할 수 있습니다`, 'success');

    // 자동으로 diff 컨테이너로 이동
    document.getElementById('diffCommit1').value = selectedCommits[0];
    document.getElementById('diffCommit2').value = selectedCommits[1];
    document.getElementById('selectedFileName').textContent = fileName;

    setTimeout(() => {
      document.getElementById('fileHistoryContainer').style.display = 'none';
      document.getElementById('fileDiffContainer').style.display = 'block';
      showFileDiff();
    }, 500);
  } else {
    selectedCommits = [hash];
    showMessage('configMessage', `선택 초기화. 첫 번째 버전: ${hash.substring(0, 7)}`, 'success');
  }
}

// File Diff
async function showFileDiff() {
  const fileName = document.getElementById('selectedFileName').textContent;
  const commit1 = document.getElementById('diffCommit1').value.trim();
  const commit2 = document.getElementById('diffCommit2').value.trim();

  if (!fileName || !commit1 || !commit2) {
    showMessage('configMessage', '파일명과 두 커밋을 모두 지정하세요', 'error');
    return;
  }

  const diffContent = document.getElementById('diffContent');
  diffContent.textContent = '변경 사항 로드 중...';

  try {
    const response = await fetch(
      `/api/file-diff?file=${encodeURIComponent(fileName)}&commit1=${commit1}&commit2=${commit2}`
    );
    const data = await response.json();

    if (response.ok) {
      const diff = data.diff || '차이가 없습니다';
      formatAndDisplayDiff(diff, commit1.substring(0, 7), commit2.substring(0, 7));
    } else {
      diffContent.textContent = '오류: ' + (data.error || '알 수 없는 오류');
    }
  } catch (err) {
    diffContent.textContent = '로드 실패: ' + err.message;
  }
}

function formatAndDisplayDiff(rawDiff, commit1, commit2) {
  if (rawDiff === '차이가 없습니다' || !rawDiff.includes('diff --git')) {
    document.getElementById('diffContent').textContent = '차이가 없습니다';
    document.getElementById('diffStats').style.display = 'none';
    return;
  }

  // 복원 정보 업데이트
  const commit2Full = document.getElementById('diffCommit2').value.trim();
  document.getElementById('revertCommitInfo').textContent =
    `${commit2} (${commit2Full.substring(0, 12)}...)의 파일 상태`;

  const lines = rawDiff.split('\n');
  let addedCount = 0;
  let removedCount = 0;
  let fileHeader = '';
  let formattedHtml = '';
  let inHunk = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 파일 헤더
    if (line.startsWith('diff --git')) {
      formattedHtml += `<div class="diff-file-header">📄 ${line.substring(10)}</div>`;
      inHunk = false;
    }
    // Hunk 헤더
    else if (line.startsWith('@@')) {
      inHunk = true;
      formattedHtml += `<div class="diff-hunk-header">${escapeHtml(line)}</div>`;
    }
    // 추가된 라인
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      addedCount++;
      formattedHtml += `<div class="diff-line diff-line-added"><span class="diff-line-number">+</span>${escapeHtml(line.substring(1))}</div>`;
    }
    // 삭제된 라인
    else if (line.startsWith('-') && !line.startsWith('---')) {
      removedCount++;
      formattedHtml += `<div class="diff-line diff-line-removed"><span class="diff-line-number">-</span>${escapeHtml(line.substring(1))}</div>`;
    }
    // 컨텍스트 라인 또는 메타데이터
    else if (inHunk && (line.startsWith(' ') || line === '')) {
      if (line !== '') {
        formattedHtml += `<div class="diff-line diff-line-context"><span class="diff-line-number"> </span>${escapeHtml(line.substring(1))}</div>`;
      }
    }
    // 메타데이터 행들
    else if (line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++') || line === '') {
      // 무시
    }
  }

  // 통계 표시
  const statsHtml = `
    <div class="diff-stat-item">
      <span class="diff-stat-label">추가된 라인:</span>
      <span class="diff-stat-value diff-added">+${addedCount}</span>
    </div>
    <div class="diff-stat-item">
      <span class="diff-stat-label">삭제된 라인:</span>
      <span class="diff-stat-value diff-removed">-${removedCount}</span>
    </div>
    <div class="diff-stat-item">
      <span class="diff-stat-label">비교:</span>
      <span class="diff-stat-value">${commit1} → ${commit2}</span>
    </div>
    <div class="diff-stat-item">
      <span class="diff-stat-label">총 변경:</span>
      <span class="diff-stat-value">${addedCount + removedCount}줄</span>
    </div>
  `;

  document.getElementById('diffStats').innerHTML = statsHtml;
  document.getElementById('diffStats').style.display = 'flex';
  document.getElementById('diffContent').innerHTML = formattedHtml || '변경사항이 없습니다';
}

function hideDiff() {
  document.getElementById('fileDiffContainer').style.display = 'none';
  document.getElementById('fileOpsContainer').style.display = 'block';
  selectedCommits = [];
}

async function revertToCommit() {
  const fileName = document.getElementById('selectedFileName').textContent;
  const commit = document.getElementById('diffCommit2').value.trim();
  const commit1 = document.getElementById('diffCommit1').value.trim();

  if (!fileName || !commit) {
    showMessage('configMessage', '파일명과 커밋을 지정하세요', 'error');
    return;
  }

  const confirmMsg = `
파일: ${fileName}

현재 상태 → ${commit.substring(0, 7)} (${commit.substring(0, 12)}...) 버전으로 복원하시겠습니까?

⚠️ 주의: 이 작업 후 현재 변경사항은 모두 손실됩니다.
`;

  if (!confirm(confirmMsg.trim())) {
    return;
  }

  try {
    const response = await fetch('/api/revert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileName, commit: commit })
    });

    const data = await response.json();

    if (response.ok) {
      showMessage('configMessage', '✓ ' + data.message, 'success');
      hideDiff();
      refreshStatus();
    } else {
      showMessage('configMessage', '✗ ' + (data.error || '복원 실패'), 'error');
    }
  } catch (err) {
    showMessage('configMessage', '✗ 연결 실패', 'error');
  }
}
