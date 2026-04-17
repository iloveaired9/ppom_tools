# ppom_tools

웹 기반 Git 저장소 관리 도구 모음입니다.

## 프로젝트 구성

### 📚 Git GUI
브라우저에서 Git 저장소를 간단하게 관리할 수 있는 웹 애플리케이션입니다.

**주요 기능:**
- 📊 저장소 상태 대시보드 (브랜치, 수정/추적 파일 현황)
- 📝 커밋 히스토리 조회 (작성자, 날짜, 메시지)
- 🌿 브랜치 관리 및 전환
- 📁 파일 변경 이력 추적
- 🔄 파일 버전 비교 (Diff 뷰어)
- ♻️ 파일 복원 기능

**기술 스택:**
- 백엔드: Node.js + Express
- 프론트엔드: HTML5 + CSS3 + Vanilla JavaScript
- Git 통신: child_process

**[자세한 설명](./git-gui-app/README.md)**

## 시작하기

### 설치
```bash
cd git-gui-app
npm install
```

### 실행
```bash
npm start
```

브라우저에서 `http://localhost:3000` 접속

### 사용법
1. Git 저장소 경로 입력
2. 상태 대시보드에서 현재 상황 확인
3. 필요한 작업 수행 (파일 조회, 비교, 복원 등)

## 보안 주의사항
⚠️ **로컬 개발용 도구입니다**
- `localhost:3000`에서만 실행하세요
- 인터넷 노출 금지
- 신뢰할 수 있는 환경에서만 사용하세요

## 라이선스
MIT

---

더 자세한 정보는 [git-gui-app/README.md](./git-gui-app/README.md)를 참고하세요.
