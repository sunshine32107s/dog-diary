# dog-diary

치우의 하루하루: Next.js + Supabase 개인 일기.

## 소유자 로그인과 권한

- 기록·사진 열람은 공개, 작성·수정·삭제·사진 업로드는 등록 소유자만 가능.
- 이메일 링크 인증 후 같은 브라우저에서 로그인 유지 및 토큰 자동 갱신.
- 소유자 이메일은 프런트엔드/환경변수가 아니라 Supabase `private.diary_owner_config`에만 저장.
- `public.is_diary_owner()`는 권한 여부만 반환. 실제 검증은 비공개 함수에서 `auth.uid()`에 해당하는 `auth.users`의 이메일 확인 완료 여부와 소유자 이메일을 비교. 사용자 편집 가능한 `user_metadata`는 권한 판단에 사용하지 않음.
- `daily_logs` RLS와 `dog-photos` INSERT/DELETE 정책 양쪽에서 같은 소유자 검증 사용. 익명에게는 기록 SELECT만 허용.
- 변경 SQL은 운영 DB migration history의 `diary_owner_authorization_helper`, `restrict_diary_mutations_to_verified_owner`에 기록. 재설정 시 해당 정의와 정책을 확인하고 이메일을 공개 저장소에 복사하지 말 것.
- Supabase Auth Site URL은 실제 운영 URL로 설정. 이메일 링크는 평소 앱을 사용하는 브라우저에서 열 것.
- 로그인 메일 전달은 Supabase SMTP 설정/발송 제한에 영향받음. 운영 환경에서 최초 이메일 인증을 별도로 확인해야 함.
- 소유자 로그인 상태가 풀리면 입력 중인 폼은 유지되고 저장·수정·삭제는 다시 인증할 때까지 차단됨.

## 백업

달력·통계에서 CSV 또는 사진 포함 ZIP을 저장. ZIP 기능은 누를 때만 로딩되며 새 의존성 없이 ZIP STORE 형식으로 생성.

- `records.json`: 모든 DB 필드를 보존한 데이터
- `records.csv`: CSV 이스케이프 및 수식 실행 방지 처리
- `photos/`: 앱 저장소의 실제 사진 파일 (휴대폰 원본이 아닌 업로드 압축본)
- `manifest.json`: 날짜/기록 ID/사진 파일 연결 정보
- 실패한 사진이 있으면 완료 ZIP을 만들지 않음. 전체 또는 월별 선택 가능. 모바일 메모리를 위해 약 96 MiB 제한.
- 자동 복원은 아직 제공하지 않음. 백업은 개인 정보를 포함하므로 안전하게 보관할 것.

## 검증

환경변수는 `.env.example` 참고. 서버 비밀 키는 클라이언트에 넣지 않음.

```sh
npm ci
npm run lint
npm run build
node --experimental-strip-types --test tests/*.test.mjs
```

실제 운영 기록을 변경하는 테스트 대신 롤백되는 권한 테스트와 격리된 사진/백업 테스트를 사용. 하루 일기 PNG는 기존 ChiuFont와 정사각형 사진 크롭을 유지하고 메모 글자의 실제 경계를 기준으로 세로 중앙정렬.
