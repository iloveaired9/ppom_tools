---
name: git-gui
description: Create a simple web-based Git GUI tool for visual repository browsing, commit history tracking, and file version management without terminal commands. Use this skill whenever the user wants to build a visual Git client, needs a web interface for Git operations, wants to compare file versions, needs to manage repositories from a browser, mentions viewing Git history without using terminal, discusses making Git accessible for non-technical team members, wants to track and revert file changes, or mentions Git status dashboard. This generates a complete, ready-to-run application with Git status display, commit history browser, branch switching, side-by-side file diff viewer, and safe file reverting capabilities—ideal for teams that need Git management without memorizing terminal commands.
compatibility: |
  Requires: Node.js, Git installed on system
---

# Git GUI Tool Generator

## Overview

이 스킬은 완전한 웹 기반 Git GUI 애플리케이션을 생성합니다. 사용자는 Git 저장소 경로를 한 번 등록한 후, 깔끔한 브라우저 인터페이스를 통해 다음을 수행할 수 있습니다:

- 현재 Git 상태 보기 (브랜치, 변경된 파일, 커밋 상태)
- 커밋 히스토리 브라우징
- 파일 버전 비교 (사이드바이사이드)
- 파일 또는 커밋을 이전 상태로 복원
- 브랜치 전환
- 파일 히스토리와 diff 보기

생성되는 애플리케이션 포함 사항:
- **백엔드**: Node.js/Express 서버 (Git 명령 실행)
- **프론트엔드**: 간단한 HTML/CSS/JavaScript UI
- **설정**: 등록된 저장소 경로 저장
- **Diff 뷰어**: 사이드바이사이드 파일 비교
- **안전성**: 삭제 작업 전 확인 대화상자

## 생성되는 구조

```
git-gui-app/
├── package.json           # Node.js 의존성
├── server.js              # Express 백엔드
├── public/
│   ├── index.html         # 메인 UI
│   ├── style.css          # 스타일
│   └── app.js             # 프론트엔드 로직
├── config/
│   └── repo-config.json   # 저장소 경로 저장
└── README.md              # 설정 가이드
```

## 주요 기능

### 백엔드 API 엔드포인트

- `/api/status` - 현재 브랜치, 변경 파일, 커밋 상태
- `/api/commits` - 커밋 히스토리 (메시지, 날짜)
- `/api/branches` - 모든 브랜치 목록
- `/api/diff` - 버전 간 diff 보기
- `/api/revert` - 파일 또는 커밋 복원 (확인 필수)
- `/api/switch-branch` - 브랜치 변경
- `/api/configure` - 저장소 경로 등록

### 프론트엔드 UI

- 저장소 경로 등록 폼
- 상태 대시보드
- 커밋 히스토리 목록
- 파일 브라우저
- Diff 뷰어 (사이드바이사이드)
- 브랜치 선택 드롭다운
- 복원/체크아웃 버튼 (확인 대화상자)

## 사용 흐름

1. 사용자가 Git GUI 도구 요청
2. Claude가 완전한 애플리케이션 생성
3. 사용자가 `npm install && npm start` 실행
4. http://localhost:3000 접속
5. 저장소 경로 등록
6. 히스토리 탐색, 파일 비교, 복원 수행

## 기술 사항

### 백엔드 (Express)

- `child_process`를 사용한 Git 명령 실행
- 명령 검증 및 에러 핸들링
- JSON 응답
- 디렉토리 순회 공격 방지

### 프론트엔드

- 외부 라이브러리 없음 (순수 JavaScript)
- 반응형 디자인
- 모달 대화상자
- 깔끔한 UI

### 설정 파일

`config/repo-config.json`:
```json
{
  "repositoryPath": "/path/to/your/repo",
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

## 구현 방법

사용자가 Git GUI 도구를 요청할 때 Claude는 다음 단계를 따릅니다:

### 1단계: 프로젝트 구조 생성

다음 구조의 완전한 애플리케이션을 생성합니다:
```
git-gui-app/
├── package.json
├── server.js
├── .gitignore
├── README.md
├── public/
│   ├── index.html
│   ├── style.css
│   └── app.js
└── config/
    └── repo-config.json.example
```

### 2단계: package.json 작성

```json
{
  "name": "git-gui",
  "version": "1.0.0",
  "description": "Simple web-based Git GUI tool",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "body-parser": "^1.20.2"
  }
}
```

### 3단계: Express 백엔드 (server.js)

다음 기능을 포함한 Express 서버 작성:

**필수 API 엔드포인트**:
- `POST /api/configure` - 저장소 경로 등록 및 검증
- `GET /api/status` - Git 상태 (브랜치, 변경 파일)
- `GET /api/commits` - 커밋 히스토리 (최대 100개)
- `GET /api/branches` - 모든 브랜치 목록
- `GET /api/diff/:file/:commit1/:commit2` - 파일 비교
- `POST /api/revert` - 파일 복원 (확인 필수)
- `POST /api/switch-branch` - 브랜치 변경

**구현 요구사항**:
- `child_process.execSync()` 또는 `simple-git` 사용해서 Git 명령 실행
- 모든 경로 입력 검증 (디렉토리 순회 공격 방지)
- 명령어 화이트리스트 사용
- JSON 응답 형식 통일
- CORS 헤더 설정 (필요시)
- 에러 핸들링 및 사용자 친화적 에러 메시지
- 포트: 3000 (기본값)

### 4단계: 프론트엔드 UI (HTML/CSS/JavaScript)

**public/index.html**:
- 저장소 경로 입력 폼
- 상태 대시보드 (브랜치, 변경 파일 수)
- 커밋 히스토리 목록 (클릭으로 상세 정보)
- 파일 브라우저
- Diff 뷰어 (사이드바이사이드)
- 브랜치 선택 드롭다운

**public/style.css**:
- 깔끔한 UI 디자인
- 반응형 레이아웃 (모바일 지원)
- 색상 구분 (추가: 초록색, 삭제: 빨간색, 수정: 노란색)
- 모달 및 대화상자 스타일

**public/app.js**:
- Fetch API로 서버와 통신
- 저장소 경로 등록 로직
- 자동 새로고침 (5초 간격)
- Diff 뷰어 구현
- 복원 전 확인 대화상자
- 에러 메시지 표시

### 5단계: 설정 파일

**config/repo-config.json** (예제):
```json
{
  "repositoryPath": "",
  "lastUpdated": null
}
```

런타임에 저장되고, 서버 재시작 후에도 유지됨.

### 6단계: 문서 작성

**README.md** 포함:
- 기능 요약
- 설치 방법 (`npm install`)
- 실행 방법 (`npm start`)
- 사용 방법 (경로 등록 → 사용)
- API 문서
- 기술 요구사항 (Node.js, Git)
- 보안 주의사항

### 보안 고려사항

✅ 저장소 경로는 절대 경로 검증 필수  
✅ Git 명령어는 화이트리스트만 실행  
✅ 사용자 입력은 모두 검증  
✅ 디렉토리 순회 공격 방지  
✅ Destructive 작업 전 확인 대화상자  

### 완성 기준

생성된 애플리케이션은 다음을 충족해야 함:
- [ ] 모든 파일이 생성됨 (9-11개)
- [ ] `npm install`로 의존성 설치 가능
- [ ] `npm start`로 서버 실행 가능
- [ ] http://localhost:3000 접속 가능
- [ ] 저장소 경로 등록 기능 작동
- [ ] 커밋 히스토리 조회 가능
- [ ] 파일 비교 기능 작동
- [ ] 파일 복원 기능 작동 (확인 포함)
- [ ] 모바일 반응형 UI
- [ ] 한국어 UI 지원 (권장)

---

## 출력

모든 파일이 디렉토리에 생성됩니다. 사용자는 즉시:
- 의존성 설치: `npm install`
- 서버 시작: `npm start`
- http://localhost:3000 접속
