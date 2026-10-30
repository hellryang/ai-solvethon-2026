---
inclusion: always
---

# 기술 스택과 규칙

> 기본안이다. 주제 확정 후 팀이 바꾸면 이 파일을 먼저 고친 뒤 코드를 생성한다.
>
> **확인 필요 (10/30)**: 주제 가이드에 사용 가능한 서비스가 "기본 제공 서버 + Bedrock"으로 적혀 있다.
> 아래 Lambda·Amplify 배포가 허용되는지, 아니면 제공 서버 하나에 올려야 하는지 멘토·AWS 지원에게 확인한 뒤 이 표를 고친다.

## 스택

| 층 | 선택 | 배포 |
|---|---|---|
| 프론트엔드 | React + Vite (JavaScript) | AWS Amplify Hosting — GitHub `main` 연결, push하면 자동 배포 |
| API | API Gateway (HTTP API) + AWS Lambda (Python 3.12) | AWS SAM (`infra/template.yaml`) |
| AI | Amazon Bedrock (boto3 `bedrock-runtime`, Converse API) | — |
| 데이터 | DynamoDB (구조화 데이터), S3 (파일·이미지) | SAM 템플릿에 함께 정의 |
| 리전 | `ap-northeast-2` (서울) | Bedrock 모델은 콘솔 Model access에서 활성화 여부를 먼저 확인 |

## 규칙

### 비밀값 — 이 저장소는 Public이다
- AWS 액세스 키, 비밀번호, 토큰을 코드·설정 파일·문서에 문자열로 쓰지 않는다. 올라가면 수 분 안에 탈취된다.
- 로컬 인증은 `aws configure`(프로필)로 한다. Lambda는 IAM 역할로 접근한다.
- 설정값(테이블 이름, 버킷 이름, 모델 ID)은 환경변수로 읽는다. 목록은 루트 `.env.example`에 둔다.

### 백엔드
- Lambda 핸들러는 입력 검증 → service 호출 → 응답 변환만 한다. 로직은 `services/`, Bedrock은 `ai/`에 둔다.
- 응답은 항상 JSON이며 CORS 헤더를 포함한다. 에러는 `{"error": "<사용자에게 보여줄 한국어 메시지>"}`와 4xx/5xx로 돌려준다.
- Bedrock 모델 ID는 환경변수 `BEDROCK_MODEL_ID`로 받는다. 코드에 하드코딩하지 않는다.
- 외부 호출(Bedrock·DynamoDB·S3)은 try/except로 감싸고, CloudWatch에 남도록 `print` 대신 `logging`을 쓴다.
- 새 라이브러리는 `backend/requirements.txt`에 버전을 고정해 추가한다.

### 프론트엔드
- API 주소는 `import.meta.env.VITE_API_URL`로 읽는다.
- 백엔드 호출은 `src/api/`에만 둔다. 로딩·에러 상태를 화면에 표시한다 (시연 중 멈춘 것처럼 보이지 않게).

### API 계약
- 엔드포인트·요청·응답 형식의 유일한 기준은 `.kiro/specs/<기능>/design.md`다.
  프론트와 백엔드가 서로 다른 형식을 가정하지 않도록, 형식을 바꾸면 design.md를 먼저 고친다.

### 테스트
- 백엔드: `pytest`, `PYTHONPATH=backend/src`. AWS 호출은 mock한다.
- 데모 시나리오 경로의 핸들러는 최소 하나씩 테스트를 둔다.
