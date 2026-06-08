## AI Cloud Cost Detective (AWS) - Request Flow

```
①  User ─·─·─► React ─·─·─► FastAPI Auth ─·─·─► JWT (PostgreSQL)

②  User selects AWS Region / Account ─·─·─► Python Backend

③  Python ─·─·─► Boto3 (AWS SDK) ─·─·─► Fetches all resources in account/region

④  Python ─·─·─► FastAPI WebSocket ─·─·─► React (live progress)

⑤  Python ─·─·─► OpenAI API ─·─·─► Cost analysis

⑥  Python ─·─·─► PostgreSQL ─·─·─► Stores analysis history

⑦  React ◄·─·─·─ Final report with suggestions & fixes
```
