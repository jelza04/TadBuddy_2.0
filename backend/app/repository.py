"""Conversation / message persistence."""

from .db import pool


async def ensure_user(user_id: str) -> None:
    async with pool.connection() as conn:
        await conn.execute("insert into app_users (id) values (%s) on conflict do nothing", (user_id,))


async def create_conversation(user_id: str, title: str | None = None) -> str:
    async with pool.connection() as conn:
        row = await (
            await conn.execute(
                "insert into conversations (user_id, title) values (%s, %s) returning id", (user_id, title)
            )
        ).fetchone()
    return str(row[0])


async def conversation_belongs_to(conversation_id: str, user_id: str) -> bool:
    async with pool.connection() as conn:
        row = await (
            await conn.execute(
                "select 1 from conversations where id = %s and user_id = %s", (conversation_id, user_id)
            )
        ).fetchone()
    return row is not None


async def recent_history(conversation_id: str, turns: int) -> list[dict]:
    async with pool.connection() as conn:
        rows = await (
            await conn.execute(
                """
                select role, content from (
                    select role, content, created_at from messages
                    where conversation_id = %s order by created_at desc limit %s
                ) t order by created_at
                """,
                (conversation_id, turns * 2),
            )
        ).fetchall()
    return [{"role": r[0], "content": r[1]} for r in rows]


async def add_message(conversation_id: str, role: str, content: str, *, safety_flag=None,
                      model=None, latency_ms=None) -> int:
    async with pool.connection() as conn:
        row = await (
            await conn.execute(
                """
                insert into messages (conversation_id, role, content, safety_flag, model, latency_ms)
                values (%s, %s, %s, %s, %s, %s) returning id
                """,
                (conversation_id, role, content, safety_flag, model, latency_ms),
            )
        ).fetchone()
        await conn.execute("update conversations set updated_at = now() where id = %s", (conversation_id,))
    return row[0]


async def log_retrieval(message_id: int, kb_hits, memories, low_confidence: bool) -> None:
    async with pool.connection() as conn:
        await conn.execute(
            """
            insert into retrieval_logs (message_id, kb_ids, kb_distances, memory_ids, low_confidence)
            values (%s, %s, %s, %s, %s)
            """,
            (message_id, [h.id for h in kb_hits], [h.distance for h in kb_hits],
             [m.id for m in memories], low_confidence),
        )


async def list_messages(conversation_id: str) -> list[dict]:
    async with pool.connection() as conn:
        rows = await (
            await conn.execute(
                "select id, role, content, created_at from messages where conversation_id = %s order by created_at",
                (conversation_id,),
            )
        ).fetchall()
    return [{"id": r[0], "role": r[1], "content": r[2], "created_at": r[3].isoformat()} for r in rows]


async def list_memories(user_id: str) -> list[dict]:
    async with pool.connection() as conn:
        rows = await (
            await conn.execute(
                "select id, content, importance, last_seen_at from user_memories where user_id = %s "
                "order by last_seen_at desc",
                (user_id,),
            )
        ).fetchall()
    return [{"id": r[0], "content": r[1], "importance": r[2], "last_seen_at": r[3].isoformat()} for r in rows]


async def delete_memory(user_id: str, memory_id: int | None = None) -> int:
    async with pool.connection() as conn:
        if memory_id is None:
            cur = await conn.execute("delete from user_memories where user_id = %s", (user_id,))
        else:
            cur = await conn.execute(
                "delete from user_memories where user_id = %s and id = %s", (user_id, memory_id)
            )
    return cur.rowcount
