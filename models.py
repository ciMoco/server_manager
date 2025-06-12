from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from database import Base
from datetime import datetime


class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    host = Column(String(100), nullable=False)
    port = Column(Integer, default=22)
    username = Column(String(50), nullable=False)
    password = Column(String(100))  # 实际项目中应该加密
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_name = Column(String(200), nullable=False)
    command = Column(Text, nullable=False)
    server_ids = Column(String(500))  # 存储服务器ID列表，用逗号分隔
    status = Column(String(20), default="pending")  # pending, running, completed, failed
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)


class TaskResult(Base):
    __tablename__ = "task_results"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, nullable=False)
    server_id = Column(Integer, nullable=False)
    server_name = Column(String(100))
    command = Column(Text)
    output = Column(Text)
    error = Column(Text)
    exit_code = Column(Integer)
    execution_time = Column(Integer)  # 执行时间（秒）
    created_at = Column(DateTime, default=datetime.utcnow)

class CommandTemplate(Base):
    __tablename__ = "command_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    command = Column(Text, nullable=False)
    category = Column(String(50), default="general")
    description = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    command = Column(Text, nullable=False)
    server_ids = Column(String(500))
    cron_expression = Column(String(100))  # cron表达式
    is_active = Column(Boolean, default=True)
    last_run = Column(DateTime)
    next_run = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)