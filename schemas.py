from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


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


class TaskResponse(BaseModel):
    id: int
    task_name: str
    command: str
    server_ids: str
    status: str
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


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


class CommandTemplateBase(BaseModel):
    name: str
    command: str
    category: str = "general"
    description: Optional[str] = None


class CommandTemplateCreate(CommandTemplateBase):
    pass


class CommandTemplateResponse(CommandTemplateBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class ScheduledTaskBase(BaseModel):
    name: str
    command: str
    server_ids: List[int]
    cron_expression: str
    is_active: bool = True


class ScheduledTaskCreate(ScheduledTaskBase):
    pass


class ScheduledTaskResponse(BaseModel):
    id: int
    name: str
    command: str
    server_ids: str
    cron_expression: str
    is_active: bool
    last_run: Optional[datetime]
    next_run: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True
