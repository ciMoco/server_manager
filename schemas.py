from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional


class ServerBase(BaseModel):
    name: str
    host: str
    port: int = 22
    username: str
    password: str
    description: Optional[str] = None


class ServerCreate(ServerBase):
    pass


class ServerResponse(ServerBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BatchExecuteRequest(BaseModel):
    task_name: str
    command: str
    server_ids: List[int]


class TaskResultResponse(BaseModel):
    id: int
    server_name: str
    command: str
    output: Optional[str]
    error: Optional[str]
    exit_code: Optional[int]
    execution_time: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True