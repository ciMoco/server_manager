from sqlalchemy.orm import Session
from models import Server, Task, TaskResult
from schemas import ServerCreate
from datetime import datetime

def create_server(db: Session, server: ServerCreate):
    db_server = Server(**server.dict())
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    return db_server

def get_servers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Server).filter(Server.is_active == True).offset(skip).limit(limit).all()

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
        task_name=task_name,
        command=command,
        server_ids=server_ids,
        status="pending"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task

def update_task_status(db: Session, task_id: int, status: str):
    task = db.query(Task).filter(Task.id == task_id).first()
    if task:
        task.status = status
        if status == "completed":
            task.completed_at = datetime.utcnow()
        db.commit()
    return task

def create_task_result(db: Session, task_id: int, server_id: int, server_name: str,
                      command: str, output: str, error: str, exit_code: int, execution_time: int):
    result = TaskResult(
        task_id=task_id,
        server_id=server_id,
        server_name=server_name,
        command=command,
        output=output,
        error=error,
        exit_code=exit_code,
        execution_time=execution_time
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result

def get_task_results(db: Session, task_id: int):
    return db.query(TaskResult).filter(TaskResult.task_id == task_id).all()