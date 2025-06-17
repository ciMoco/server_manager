import asyncio
import time
from typing import Dict, Tuple

import paramiko


class SSHManager:
    def __init__(self):
        self.connections = {}

    async def execute_command(
        self, server_info: Dict, command: str
    ) -> Tuple[str, str, int, int]:
        """
        执行SSH命令
        返回: (stdout, stderr, exit_code, execution_time)
        """
        start_time = time.time()

        try:
            # 创建SSH客户端
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

            # 连接服务器
            ssh.connect(
                hostname=server_info["host"],
                port=server_info["port"],
                username=server_info["username"],
                password=server_info["password"],
                timeout=30,
            )

            # 执行命令
            stdin, stdout, stderr = ssh.exec_command(command, timeout=300)

            # 获取结果
            output = stdout.read().decode("utf-8", errors="ignore")
            error = stderr.read().decode("utf-8", errors="ignore")
            exit_code = stdout.channel.recv_exit_status()

            ssh.close()

            execution_time = int(time.time() - start_time)
            return output, error, exit_code, execution_time

        except Exception as e:
            execution_time = int(time.time() - start_time)
            return "", str(e), -1, execution_time

    async def batch_execute(self, servers: list, command: str) -> list:
        """批量执行命令"""
        tasks = []
        for server in servers:
            task = asyncio.create_task(self.execute_command(server, command))
            tasks.append((server, task))

        results = []
        for server, task in tasks:
            try:
                output, error, exit_code, exec_time = await task
                results.append(
                    {
                        "server": server,
                        "output": output,
                        "error": error,
                        "exit_code": exit_code,
                        "execution_time": exec_time,
                    }
                )
            except Exception as e:
                results.append(
                    {
                        "server": server,
                        "output": "",
                        "error": str(e),
                        "exit_code": -1,
                        "execution_time": 0,
                    }
                )

        return results


# 全局SSH管理器实例
ssh_manager = SSHManager()
