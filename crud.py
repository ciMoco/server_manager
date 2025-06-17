from datetime import datetime

from sqlalchemy.orm import Session

from models import Server, Task, TaskResult, CommandTemplate, ScheduledTask
from schemas import ServerCreate, CommandTemplateCreate, ScheduledTaskCreate


def create_server(db: Session, server: ServerCreate):
    db_server = Server(**server.dict())
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server


def get_servers(db: Session, skip: int = 0, limit: int = 100):
    return (
        db.query(Server)
        .filter(Server.is_active == True)
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_server(db: Session, server_id: int):
    return db.query(Server).filter(Server.id == server_id).first()


def delete_server(db: Session, server_id: int):
    server = db.query(Server).filter(Server.id == server_id).first()
    if server:
        server.is_active = False
        db.commit()
    return server


def create_task(db: Session, task_name: str, command: str, server_ids: str):
    db_task = Task(
        task_name=task_name, command=command, server_ids=server_ids, status="pending"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_tasks(db: Session, skip: int = 0, limit: int = 100, status: str = None):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    return query.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()


def get_task(db: Session, task_id: int):
    return db.query(Task).filter(Task.id == task_id).first()


def update_task_status(db: Session, task_id: int, status: str):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        task.status = status
        if status == "completed":
            task.completed_at = datetime.utcnow()
        db.commit()
    return task


def create_task_result(
    db: Session,
    task_id: int,
    server_id: int,
    server_name: str,
    command: str,
    output: str,
    error: str,
    exit_code: int,
    execution_time: int,
):
    result = TaskResult(
        task_id=task_id,
        server_id=server_id,
        server_name=server_name,
        command=command,
        output=output,
        error=error,
        exit_code=exit_code,
        execution_time=execution_time,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_task_results(db: Session, task_id: int):
    return db.query(TaskResult).filter(TaskResult.task_id == task_id).all()


# 命令模板相关
def create_command_template(db: Session, template: CommandTemplateCreate):
    db_template = CommandTemplate(**template.dict())
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template


def get_command_templates(db: Session, category: str = None):
    query = db.query(CommandTemplate)
    if category:
        query = query.filter(CommandTemplate.category == category)
    return query.order_by(CommandTemplate.created_at.desc()).all()


def get_command_template(db: Session, template_id: int):
    return db.query(CommandTemplate).filter(CommandTemplate.id == template_id).first()


def delete_command_template(db: Session, template_id: int):
    template = (
        db.query(CommandTemplate).filter(CommandTemplate.id == template_id).first()
    )
    if template:
        db.delete(template)
        db.commit()
    return template


# 定时任务相关
def create_scheduled_task(db: Session, task: ScheduledTaskCreate):
    task_data = task.dict()
    task_data["server_ids"] = ",".join(map(str, task_data["server_ids"]))
    db_task = ScheduledTask(**task_data)
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_scheduled_tasks(db: Session, active_only: bool = True):
    query = db.query(ScheduledTask)
    if active_only:
        query = query.filter(ScheduledTask.is_active == True)
    return query.order_by(ScheduledTask.created_at.desc()).all()


def get_scheduled_task(db: Session, task_id: int):
    return db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()


def update_scheduled_task_status(db: Session, task_id: int, is_active: bool):
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
    if task:
        task.is_active = is_active
        db.commit()
    return task


def delete_scheduled_task(db: Session, task_id: int):
    task = db.query(ScheduledTask).filter(ScheduledTask.id == task_id).first()
    if task:
        db.delete(task)
        db.commit()
    return task
