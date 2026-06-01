CREATE TABLE IF NOT EXISTS attention_messages (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id      UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  recipient_id   UUID        NOT NULL REFERENCES verified_vibe_users(id) ON DELETE CASCADE,
  message_type   TEXT        NOT NULL CHECK (message_type IN ('secret_admirer', 'craving_attention')),
  content        TEXT        NOT NULL,
  reply_content  TEXT,
  reply_sent_at  TIMESTAMPTZ,
  is_read        BOOLEAN     NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_attention_messages_recipient ON attention_messages (recipient_id);
CREATE INDEX IF NOT EXISTS idx_attention_messages_sender    ON attention_messages (sender_id);

ALTER TABLE attention_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_attention" ON attention_messages;
CREATE POLICY "service_role_all_attention"
ON attention_messages FOR ALL TO service_role USING (true);;
