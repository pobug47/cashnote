# 자산 보드

가계부, 저축, 투자, 배당주 회수율을 한 화면에서 관리하는 웹앱 MVP입니다.
현재 저장소는 PostgreSQL 서버 DB를 기준으로 동작하며, Docker Compose로 앱과 DB를 함께 실행할 수 있습니다.

## 실행

PostgreSQL이 이미 실행 중이면 `DATABASE_URL`을 지정한 뒤 앱을 실행합니다.

```powershell
$env:DATABASE_URL="postgres://finance:finance@localhost:5432/finance_board"
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:5173
```

## Docker 실행

로컬 PC나 클라우드 서버에서 앱과 PostgreSQL을 같이 올릴 때는 아래 명령을 사용합니다.

```powershell
docker compose up --build
```

구성은 다음과 같습니다.

- `app`: Node.js 웹 서버, 기본 포트 `5173`
- `postgres`: PostgreSQL 16, 기본 DB `finance_board`
- `postgres-data`: DB 데이터를 유지하는 Docker volume

DB 연결은 `DATABASE_URL` 환경변수로 바꿀 수 있습니다.

```text
postgres://finance:finance@postgres:5432/finance_board
```

클라우드 DB처럼 SSL이 필요한 경우 `DATABASE_SSL=true`를 같이 지정합니다.
실제 운영 서버에서는 `POSTGRES_PASSWORD`와 `DATABASE_URL`의 비밀번호를 반드시 변경하세요.

## Google Cloud VM 운영 배포

운영 VM에서는 `docker-compose.prod.yml`을 사용합니다. 앱 컨테이너의 `5173` 포트는 외부에 직접 열지 않고, Caddy가 `80/443`으로 받아 앱에 전달합니다.

```powershell
Copy-Item .env.production.example .env
```

`.env`에서 `POSTGRES_PASSWORD`를 긴 임의 문자열로 바꿉니다. 도메인을 아직 연결하지 않았다면 `CADDY_HOST=:80`으로 두고 외부 IP의 HTTP 접속으로 먼저 확인합니다.
관리자 공지 기능을 사용하려면 관리자 계정 이메일을 쉼표로 구분해 `ADMIN_EMAILS`에 입력합니다.

```text
ADMIN_EMAILS=owner@example.com
```

```powershell
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

도메인을 연결한 뒤에는 `.env`를 아래처럼 바꾸면 Caddy가 Let's Encrypt 인증서를 자동 발급해 `443` HTTPS를 사용합니다.

```text
CADDY_HOST=cashnote.example.com
```

그 다음 다시 반영합니다.

```powershell
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

## 확인

```powershell
npm run check
```

## 모바일 앱 지원

현재 서비스는 PWA로 구성되어 Android와 iOS에서 홈 화면에 추가해 앱처럼 실행할 수 있습니다.

- Android Chrome: 사이트 접속 후 메뉴에서 `앱 설치` 또는 `홈 화면에 추가`
- iOS Safari: 공유 버튼에서 `홈 화면에 추가`
- 로컬 개발 중 아이콘을 다시 만들 때: `npm run pwa:icons`

Play Store나 App Store 배포가 필요하면 현재 웹앱을 Capacitor로 감싸 Android/iOS 프로젝트를 생성하는 방식으로 확장할 수 있습니다. 이 경우 실제 가족 공유를 위해서는 localStorage 대신 서버 DB 저장 구조가 필요합니다.

## 현재 구현된 기능

- 월 요약 보드: 수입, 지출, 저축/투자, 가용 잔액
- 월별 지출 카테고리 막대 그래프
- 거래 내역 추가
- 증권 추가/수정
- 수량, 평단가, 예상 월 배당 기반 연 배당 회수율 계산
- 티커 기준 월 요약 보드와 투자 항목 연동
- 누적 저축, 누적 식비, 예상 연 배당 회고 화면
- PostgreSQL 기반 사용자/가계부/초대코드/세션 저장
- 관리자 공지 등록 및 로그인 공지 팝업
- 브라우저 로컬 저장소 캐시는 임시 오프라인 보조 저장소로 사용

## 다음 개발 후보

- 월별 예산 설정
- 저축 상품 만기 금액 계산
- 서버 인증 강화: SMS/이메일 인증, 비밀번호 재설정 검증
- 운영 배포: HTTPS, 도메인, 백업, 모니터링
- 은행/증권 조회 API 연동 가능성 검토
