ALTER TABLE users
  ADD COLUMN withdrawn_at datetime DEFAULT NULL,
  ADD KEY idx_users_withdrawn_at (withdrawn_at);
