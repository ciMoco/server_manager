from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import asyncio
import os

from database import get_db, create_tables
from models import Server, Task, TaskResult, CommandTemplate, ScheduledTask
from schemas import (ServerCreate, ServerResponse, BatchExecuteRequest, TaskResultResponse,
                     TaskResponse, CommandTemplateCreate, CommandTemplateResponse,
                     ScheduledTaskCreate, ScheduledTaskResponse)
import crud
from ssh_manager import ssh_manager

app = FastAPI(title="服务器批量管理平台", version="1.0.0")

# 添加CORS中间件
app.add_middleware(
CORSMiddleware,
allow_origins=["*"], # 生产环境应该限制具体域名
allow_credentials=True,
allow_methods=["*"],
allow_headers=["*"],
)

# 创建数据库表
create_tables()

# 静态文件服务
if not os.path.exists("static"):
    os.makedirs("static")

@app.get("/")
def read_root():
    """返回前端页面"""
    return FileResponse('static/index.html')


# 服务器管理API
@app.post("/api/servers/", response_model=ServerResponse)
def create_server(server: ServerCreate, db: Session = Depends(get_db)):
    """创建服务器"""
    return crud.create_server(db=db, server=server)


@app.get("/api/servers/", response_model=List[ServerResponse])
def list_servers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取服务器列表"""
    return crud.get_servers(db, skip=skip, limit=limit)


@app.get("/api/servers/{server_id}", response_model=ServerResponse)
def get_server(server_id: int, db: Session = Depends(get_db)):
    """获取单个服务器信息"""
    server = crud.get_server(db, server_id=server_id)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return server


@app.delete("/api/servers/{server_id}")
def delete_server(server_id: int, db: Session = Depends(get_db)):
    """删除服务器"""
    server = crud.delete_server(db, server_id=server_id)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return {"message": "服务器删除成功"}


# 任务执行API
@app.post("/api/execute/")
async def batch_execute(request: BatchExecuteRequest, db: Session = Depends(get_db)):
    """批量执行命令"""
    servers = []
    for server_id in request.server_ids:
        server = crud.get_server(db, server_id)
        if server:
            servers.append({
                'id': server.id,
                'name': server.name,
                'host': server.host,
                'port': server.port,
                'username': server.username,
                'password': server.password
            })

    if not servers:
        raise HTTPException(status_code=404, detail="没有找到有效的服务器")

    task = crud.create_task(
        db=db,
        task_name=request.task_name,
        command=request.command,
        server_ids=",".join(map(str, request.server_ids))
    )

    crud.update_task_status(db, task.id, "running")

    try:
        results = await ssh_manager.batch_execute(servers, request.command)

        for result in results:
            crud.create_task_result(
                db=db,
                task_id=task.id,
                server_id=result['server']['id'],
                server_name=result['server']['name'],
                command=request.command,
                output=result['output'],
                error=result['error'],
                exit_code=result['exit_code'],
                execution_time=result['execution_time']
            )

        crud.update_task_status(db, task.id, "completed")

        return {
            "task_id": task.id,
            "message": f"命令执行完成，共处理 {len(results)} 台服务器",
            "results": results
        }

    except Exception as e:
        crud.update_task_status(db, task.id, "failed")
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")


# 任务历史API
@app.get("/api/tasks/", response_model=List[TaskResponse])
def list_tasks(skip: int = 0, limit: int = 100, status: Optional[str] = None, db: Session = Depends(get_db)):
    """获取任务历史"""
    return crud.get_tasks(db, skip=skip, limit=limit, status=status)


@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """获取单个任务信息"""
    task = crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@app.get("/api/tasks/{task_id}/results", response_model=List[TaskResultResponse])
def get_task_results(task_id: int, db: Session = Depends(get_db)):
    """获取任务执行结果"""
    results = crud.get_task_results(db, task_id)
    return results


# 命令模板API
@app.post("/api/templates/", response_model=CommandTemplateResponse)
def create_template(template: CommandTemplateCreate, db: Session = Depends(get_db)):
    """创建命令模板"""
    return crud.create_command_template(db, template)


@app.get("/api/templates/", response_model=List[CommandTemplateResponse])
def list_templates(category: Optional[str] = None, db: Session = Depends(get_db)):
    """获取命令模板列表"""
    return crud.get_command_templates(db, category=category)


@app.get("/api/templates/{template_id}", response_model=CommandTemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    """获取单个命令模板"""
    template = crud.get_command_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return template


@app.delete("/api/templates/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    """删除命令模板"""
    template = crud.delete_command_template(db, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")
    return {"message": "模板删除成功"}


# 定时任务API
@app.post("/api/scheduled/", response_model=ScheduledTaskResponse)
def create_scheduled_task(task: ScheduledTaskCreate, db: Session = Depends(get_db)):
    """创建定时任务"""
    return crud.create_scheduled_task(db, task)


@app.get("/api/scheduled/", response_model=List[ScheduledTaskResponse])
def list_scheduled_tasks(active_only: bool = True, db: Session = Depends(get_db)):
    """获取定时任务列表"""
    return crud.get_scheduled_tasks(db, active_only=active_only)


@app.put("/api/scheduled/{task_id}/toggle")
def toggle_scheduled_task(task_id: int, db: Session = Depends(get_db)):
    """启用/禁用定时任务"""
    task = crud.get_scheduled_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="定时任务不存在")

    updated_task = crud.update_scheduled_task_status(db, task_id, not task.is_active)
    return {"message": f"定时任务已{'启用' if updated_task.is_active else '禁用'}"}


@app.delete("/api/scheduled/{task_id}")
def delete_scheduled_task(task_id: int, db: Session = Depends(get_db)):
    """删除定时任务"""
    task = crud.delete_scheduled_task(db, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="定时任务不存在")
    return {"message": "定时任务删除成功"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
