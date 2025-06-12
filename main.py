from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import asyncio

from database import get_db, create_tables
from models import Server, Task, TaskResult
from schemas import ServerCreate, ServerResponse, BatchExecuteRequest, TaskResultResponse
import crud
from ssh_manager import ssh_manager

app = FastAPI(title="服务器批量管理平台", version="1.0.0")

# 创建数据库表
create_tables()


@app.get("/")
def hello():
    return {"message": "服务器管理平台启动成功！"}


@app.post("/servers/", response_model=ServerResponse)
def create_server(server: ServerCreate, db: Session = Depends(get_db)):
    """创建服务器"""
    return crud.create_server(db=db, server=server)


@app.get("/servers/", response_model=List[ServerResponse])
def list_servers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """获取服务器列表"""
    return crud.get_servers(db, skip=skip, limit=limit)


@app.get("/servers/{server_id}", response_model=ServerResponse)
def get_server(server_id: int, db: Session = Depends(get_db)):
    """获取单个服务器信息"""
    server = crud.get_server(db, server_id=server_id)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return server


@app.delete("/servers/{server_id}")
def delete_server(server_id: int, db: Session = Depends(get_db)):
    """删除服务器"""
    server = crud.delete_server(db, server_id=server_id)
    if not server:
        raise HTTPException(status_code=404, detail="服务器不存在")
    return {"message": "服务器删除成功"}


@app.post("/execute/")
async def batch_execute(request: BatchExecuteRequest, db: Session = Depends(get_db)):
    """批量执行命令"""
    # 获取服务器信息
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

    # 创建任务记录
    task = crud.create_task(
        db=db,
        task_name=request.task_name,
        command=request.command,
        server_ids=",".join(map(str, request.server_ids))
    )

    # 更新任务状态为运行中
    crud.update_task_status(db, task.id, "running")

    try:
        # 执行批量命令
        results = await ssh_manager.batch_execute(servers, request.command)

        # 保存执行结果
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

        # 更新任务状态为完成
        crud.update_task_status(db, task.id, "completed")

        return {
            "task_id": task.id,
            "message": f"命令执行完成，共处理 {len(results)} 台服务器",
            "results": results
        }

    except Exception as e:
        crud.update_task_status(db, task.id, "failed")
        raise HTTPException(status_code=500, detail=f"执行失败: {str(e)}")


@app.get("/tasks/{task_id}/results", response_model=List[TaskResultResponse])
def get_task_results(task_id: int, db: Session = Depends(get_db)):
    """获取任务执行结果"""
    results = crud.get_task_results(db, task_id)
    return results


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)