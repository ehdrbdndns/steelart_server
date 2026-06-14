# 회원 탈퇴 후 기존 Access Token 유예

회원 탈퇴 API는 refresh token을 폐기해 재발급과 장기 세션을 막지만, 이미 발급된 access token을 즉시 차단하기 위해 모든 보호 API의 공통 인증 경로에서 `users.withdrawn_at`을 조회하지는 않는다. 현재 access token 만료 시간은 1시간이므로 탈퇴 직후 기존 access token이 만료될 때까지 일부 보호 API 호출이 가능할 수 있지만, MVP 단계에서는 보안 엄격성보다 구현 단순성과 공통 인증 경로의 DB 조회 회피를 우선한다.

## Consequences

- 탈퇴 완료 시 앱은 로컬 토큰을 삭제하고 로그인 화면으로 이동해야 한다.
- 서버는 refresh token을 revoke하므로 탈퇴 이후 access token 재발급은 불가능하다.
- 즉시 차단이 필요해지면 공통 인증 단계에서 `users.withdrawn_at IS NULL` 검사를 추가하는 방식으로 정책을 강화한다.
