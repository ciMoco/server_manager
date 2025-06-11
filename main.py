import uvicorn
from fastapi import FastAPI, Depends
from sqlalchemy.orm import Session
from database import get_db, create_tables

app = FastAPI(title="服务器批量管理平台", version="1.0")

# 创建数据库表
create_tables()

@app.get("/")
def hello():
    return {"message": "服务器批量管理平台启动成功"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
