const API_BASE = window.location.origin;
let servers = [];
let selectedServers = [];
let templates = [];
let tasks = [];
let scheduledTasks = [];

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 添加页面加载动画
    showPageLoader();
    
    // 初始化数据
    Promise.all([
        loadServers(),
        loadCommandTemplates(),
        loadScheduledTasks(),
        loadTaskHistory()
    ]).then(() => {
        hidePageLoader();
    }).catch(error => {
        console.error('初始化数据失败:', error);
        hidePageLoader();
        showAlert('初始化数据失败，请刷新页面重试', 'error');
    });

    // 注册事件监听
    document.getElementById('serverForm').addEventListener('submit', addServer);
    document.getElementById('executeForm').addEventListener('submit', executeCommand);
    document.getElementById('templateForm').addEventListener('submit', createCommandTemplate);
    document.getElementById('scheduledForm').addEventListener('submit', createScheduledTask);
    
    // 添加命令模板搜索功能
    document.getElementById('templateSearch').addEventListener('input', filterTemplates);
    
    // 添加任务历史筛选功能
    document.getElementById('taskFilter').addEventListener('change', filterTasks);
});

// 显示页面加载动画
function showPageLoader() {
    const loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.innerHTML = `
        <div class="loader-container">
            <div class="spinner"></div>
            <p>加载中...</p>
        </div>
    `;
    document.body.appendChild(loader);
}

// 隐藏页面加载动画
function hidePageLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('fade-out');
        setTimeout(() => {
            loader.remove();
        }, 500);
    }
}

// 切换标签页
function switchTab(tabName) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`.nav-item[onclick="switchTab('${tabName}')"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');

    // 保存当前标签页到本地存储
    localStorage.setItem('activeTab', tabName);

    if (tabName === 'execute') {
        updateServerSelector();
    } else if (tabName === 'scheduled') {
        updateScheduledServerSelector();
    } else if (tabName === 'tasks') {
        loadTaskHistory();
    }
}

// 加载服务器列表
async function loadServers() {
    try {
        const response = await fetch(`${API_BASE}/api/servers/`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        servers = await response.json();
        updateServerList();
        updateServerSelector();
        updateScheduledServerSelector();
        return servers;
    } catch (error) {
        console.error('加载服务器列表失败:', error);
        showAlert('加载服务器列表失败: ' + error.message, 'error');
        throw error;
    }
}

// 更新服务器列表显示
function updateServerList() {
    const container = document.getElementById('serverList');
    if (servers.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🖥️</div>
                <h3>暂无服务器</h3>
                <p>请添加您的第一台服务器</p>
            </div>
        `;
        return;
    }
    container.innerHTML = servers.map(server => `
        <div class="server-card" data-id="${server.id}">
            <div class="server-info">
                <h3>${server.name}</h3>
                <p><strong>地址:</strong> ${server.host}:${server.port} | <strong>用户:</strong> ${server.username}</p>
                ${server.description ? `<p><strong>描述:</strong> ${server.description}</p>` : ''}
            </div>
            <div class="server-actions">
                <button class="btn btn-primary" onclick="testConnection(${server.id})">测试连接</button>
                <button class="btn btn-danger" onclick="deleteServer(${server.id})">删除</button>
            </div>
        </div>
    `).join('');
}

// 测试服务器连接
async function testConnection(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    const serverCard = document.querySelector(`.server-card[data-id="${serverId}"]`);
    const testBtn = serverCard.querySelector('.btn-primary');
    const originalText = testBtn.textContent;
    
    testBtn.disabled = true;
    testBtn.textContent = '测试中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/servers/${serverId}/test`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                showAlert(`连接成功: ${server.name}`, 'success');
            } else {
                showAlert(`连接失败: ${result.message}`, 'error');
            }
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '连接测试失败');
        }
    } catch (error) {
        console.error('测试连接失败:', error);
        showAlert(`测试连接失败: ${error.message}`, 'error');
    } finally {
        testBtn.disabled = false;
        testBtn.textContent = originalText;
    }
}

// 更新服务器选择器
function updateServerSelector() {
    const container = document.getElementById('serverSelector');
    if (servers.length === 0) {
        container.innerHTML = '<p>暂无可用服务器，请先添加服务器</p>';
        return;
    }
    
    container.innerHTML = servers.map(server => `
        <label class="${selectedServers.includes(server.id) ? 'selected' : ''}">
            <input type="checkbox" value="${server.id}" ${selectedServers.includes(server.id) ? 'checked' : ''} onchange="updateSelectedServers(this)">
            ${server.name} (${server.host})
        </label>
    `).join('');
}

// 更新选中的服务器
function updateSelectedServers(checkbox) {
    const serverId = parseInt(checkbox.value);
    const label = checkbox.parentElement;
    
    if (checkbox.checked) {
        if (!selectedServers.includes(serverId)) {
            selectedServers.push(serverId);
            label.classList.add('selected');
        }
    } else {
        selectedServers = selectedServers.filter(id => id !== serverId);
        label.classList.remove('selected');
    }
}

// 添加服务器
async function addServer(event) {
    event.preventDefault();
    const form = document.getElementById('serverForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // 表单验证
    const serverName = document.getElementById('serverName').value.trim();
    const serverHost = document.getElementById('serverHost').value.trim();
    const serverPort = parseInt(document.getElementById('serverPort').value);
    const serverUsername = document.getElementById('serverUsername').value.trim();
    const serverPassword = document.getElementById('serverPassword').value;
    
    if (!serverName || !serverHost || !serverUsername || !serverPassword) {
        showAlert('请填写所有必填字段', 'error');
        return;
    }
    
    const serverData = {
        name: serverName,
        host: serverHost,
        port: serverPort,
        username: serverUsername,
        password: serverPassword,
        description: document.getElementById('serverDescription').value.trim()
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = '添加中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/servers/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(serverData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showAlert(`服务器 ${result.name} 添加成功!`, 'success');
            form.reset();
            await loadServers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '添加失败');
        }
    } catch (error) {
        console.error('添加服务器失败:', error);
        showAlert(`添加服务器失败: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 删除服务器
async function deleteServer(serverId) {
    if (!confirm('确定要删除这台服务器吗？')) return;
    
    const serverCard = document.querySelector(`.server-card[data-id="${serverId}"]`);
    if (serverCard) {
        serverCard.classList.add('deleting');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/servers/${serverId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('服务器删除成功!', 'success');
            await loadServers();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除服务器失败:', error);
        showAlert(`删除服务器失败: ${error.message}`, 'error');
        if (serverCard) {
            serverCard.classList.remove('deleting');
        }
    }
}

// 执行命令
async function executeCommand(event) {
    event.preventDefault();
    const form = document.getElementById('executeForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    const resultContainer = document.getElementById('executeResult');
    
    // 表单验证
    const command = document.getElementById('command').value.trim();
    const selectedServers = getSelectedServers();
    
    if (!command) {
        showAlert('请输入要执行的命令', 'error');
        return;
    }
    
    if (selectedServers.length === 0) {
        showAlert('请至少选择一台服务器', 'error');
        return;
    }
    
    const executeData = {
        command: command,
        server_ids: selectedServers
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = '执行中...';
    resultContainer.innerHTML = '<div class="loading-spinner"></div><p class="text-center">命令执行中，请稍候...</p>';
    
    try {
        const response = await fetch(`${API_BASE}/api/execute/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(executeData)
        });
        
        if (response.ok) {
            const result = await response.json();
            displayExecuteResult(result);
            // 刷新任务历史
            await loadTaskHistory();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '执行失败');
        }
    } catch (error) {
        console.error('执行命令失败:', error);
        showAlert(`执行命令失败: ${error.message}`, 'error');
        resultContainer.innerHTML = `<div class="alert alert-error">执行失败: ${error.message}</div>`;
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 显示执行结果
function displayExecuteResult(results) {
    const resultContainer = document.getElementById('executeResult');
    resultContainer.innerHTML = '';
    
    if (!results || results.length === 0) {
        resultContainer.innerHTML = '<div class="alert alert-info">没有返回结果</div>';
        return;
    }
    
    const resultHeader = document.createElement('div');
    resultHeader.className = 'result-header';
    resultHeader.innerHTML = `<h3>执行结果 (${results.length}台服务器)</h3>`;
    resultContainer.appendChild(resultHeader);
    
    results.forEach(result => {
        const serverResult = document.createElement('div');
        serverResult.className = `server-result ${result.success ? 'success' : 'error'}`;
        
        const serverInfo = document.createElement('div');
        serverInfo.className = 'server-info';
        serverInfo.innerHTML = `
            <h4>${result.server_name} (${result.server_host})</h4>
            <span class="status-badge ${result.success ? 'success' : 'error'}">
                ${result.success ? '成功' : '失败'}
            </span>
        `;
        
        const resultContent = document.createElement('div');
        resultContent.className = 'result-content';
        
        if (result.success) {
            resultContent.innerHTML = `
                <div class="output">
                    <h5>输出:</h5>
                    <pre>${result.output || '(无输出)'}</pre>
                </div>
            `;
        } else {
            resultContent.innerHTML = `
                <div class="error-message">
                    <h5>错误:</h5>
                    <pre>${result.error || '未知错误'}</pre>
                </div>
            `;
        }
        
        serverResult.appendChild(serverInfo);
        serverResult.appendChild(resultContent);
        resultContainer.appendChild(serverResult);
    });
}

// 显示提示信息
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    const contentDiv = document.querySelector('.content');
    contentDiv.prepend(alertDiv);
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// 加载命令模板列表
async function loadTemplates() {
    const templateList = document.getElementById('templateList');
    const templateSelector = document.getElementById('templateSelector');
    const searchInput = document.getElementById('templateSearch');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    try {
        const response = await fetch(`${API_BASE}/api/templates/`);
        if (response.ok) {
            const templates = await response.json();
            updateTemplateList(templates, searchTerm);
            updateTemplateSelector(templates);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '加载失败');
        }
    } catch (error) {
        console.error('加载命令模板失败:', error);
        showAlert(`加载命令模板失败: ${error.message}`, 'error');
        templateList.innerHTML = `<div class="alert alert-error">加载失败: ${error.message}</div>`;
        if (templateSelector) {
            templateSelector.innerHTML = '<option value="">-- 选择模板 --</option>';
        }
    }
}

// 更新命令模板列表
function updateTemplateList(templates, searchTerm = '') {
    const templateList = document.getElementById('templateList');
    templateList.innerHTML = '';
    
    const filteredTemplates = searchTerm 
        ? templates.filter(t => t.name.toLowerCase().includes(searchTerm) || 
                             t.command.toLowerCase().includes(searchTerm) ||
                             t.category.toLowerCase().includes(searchTerm))
        : templates;
    
    if (filteredTemplates.length === 0) {
        templateList.innerHTML = `
            <div class="empty-state">
                ${searchTerm ? '没有找到匹配的命令模板' : '暂无命令模板'}
                ${searchTerm ? `<button class="btn" onclick="document.getElementById('templateSearch').value=''; loadTemplates();">清除搜索</button>` : ''}
            </div>
        `;
        return;
    }
    
    // 按分类分组
    const categorizedTemplates = {};
    filteredTemplates.forEach(template => {
        const category = template.category || '未分类';
        if (!categorizedTemplates[category]) {
            categorizedTemplates[category] = [];
        }
        categorizedTemplates[category].push(template);
    });
    
    // 渲染分组后的模板
    Object.keys(categorizedTemplates).sort().forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'template-category';
        categoryDiv.innerHTML = `<h3>${category}</h3>`;
        
        const templatesInCategory = categorizedTemplates[category];
        templatesInCategory.forEach(template => {
            const templateCard = document.createElement('div');
            templateCard.className = 'template-card';
            templateCard.dataset.id = template.id;
            
            templateCard.innerHTML = `
                <div class="template-header">
                    <h4>${template.name}</h4>
                    <div class="template-actions">
                        <button class="btn btn-sm" onclick="useTemplate(${template.id})">使用</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteTemplate(${template.id})">删除</button>
                    </div>
                </div>
                <div class="template-body">
                    <pre>${template.command}</pre>
                </div>
            `;
            
            categoryDiv.appendChild(templateCard);
        });
        
        templateList.appendChild(categoryDiv);
    });
}

// 更新命令模板选择器
function updateTemplateSelector(templates) {
    const templateSelector = document.getElementById('templateSelector');
    if (!templateSelector) return;
    
    templateSelector.innerHTML = '<option value="">-- 选择模板 --</option>';
    
    // 按分类分组
    const categorizedTemplates = {};
    templates.forEach(template => {
        const category = template.category || '未分类';
        if (!categorizedTemplates[category]) {
            categorizedTemplates[category] = [];
        }
        categorizedTemplates[category].push(template);
    });
    
    // 创建分组的选项
    Object.keys(categorizedTemplates).sort().forEach(category => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = category;
        
        categorizedTemplates[category].forEach(template => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            optgroup.appendChild(option);
        });
        
        templateSelector.appendChild(optgroup);
    });
}

// 使用命令模板
async function useTemplate(templateId) {
    try {
        const response = await fetch(`${API_BASE}/api/templates/${templateId}`);
        if (response.ok) {
            const template = await response.json();
            document.getElementById('command').value = template.command;
            
            // 切换到执行命令标签页
            document.querySelector('a[href="#execute"]').click();
            
            // 滚动到命令输入框
            document.getElementById('command').scrollIntoView({ behavior: 'smooth' });
            document.getElementById('command').focus();
            
            showAlert(`已加载模板: ${template.name}`, 'success');
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '加载模板失败');
        }
    } catch (error) {
        console.error('使用模板失败:', error);
        showAlert(`使用模板失败: ${error.message}`, 'error');
    }
}

// 创建命令模板
async function createTemplate(event) {
    event.preventDefault();
    const form = document.getElementById('templateForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // 表单验证
    const templateName = document.getElementById('templateName').value.trim();
    const templateCommand = document.getElementById('templateCommand').value.trim();
    const templateCategory = document.getElementById('templateCategory').value.trim();
    
    if (!templateName || !templateCommand) {
        showAlert('请填写模板名称和命令', 'error');
        return;
    }
    
    const templateData = {
        name: templateName,
        command: templateCommand,
        category: templateCategory || '未分类'
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/templates/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(templateData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showAlert(`模板 ${result.name} 创建成功!`, 'success');
            form.reset();
            await loadTemplates();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '创建失败');
        }
    } catch (error) {
        console.error('创建模板失败:', error);
        showAlert(`创建模板失败: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 删除命令模板
async function deleteTemplate(templateId) {
    if (!confirm('确定要删除这个命令模板吗？')) return;
    
    const templateCard = document.querySelector(`.template-card[data-id="${templateId}"]`);
    if (templateCard) {
        templateCard.classList.add('deleting');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('命令模板删除成功!', 'success');
            await loadTemplates();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除模板失败:', error);
        showAlert(`删除模板失败: ${error.message}`, 'error');
        if (templateCard) {
            templateCard.classList.remove('deleting');
        }
    }
}

// 更新定时任务服务器选择器
function updateScheduledServerSelector() {
    const container = document.getElementById('scheduledServerSelector');
    container.innerHTML = servers.map(server => `
        <label>
            <input type="checkbox" value="${server.id}" onchange="updateScheduledSelectedServers()">
            ${server.name} (${server.host})
        </label>
    `).join('');
}

// 更新选中的定时任务服务器
function updateScheduledSelectedServers() {
    selectedServers = Array.from(document.querySelectorAll('#scheduledServerSelector input:checked')).map(checkbox => parseInt(checkbox.value));
}

// 创建定时任务
async function createScheduledTask(event) {
    event.preventDefault();
    const form = document.getElementById('scheduledTaskForm');
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    
    // 表单验证
    const taskName = document.getElementById('scheduledTaskName').value.trim();
    const taskCommand = document.getElementById('scheduledTaskCommand').value.trim();
    const taskCron = document.getElementById('scheduledTaskCron').value.trim();
    const selectedServers = getSelectedScheduledServers();
    
    if (!taskName || !taskCommand || !taskCron) {
        showAlert('请填写任务名称、命令和Cron表达式', 'error');
        return;
    }
    
    if (selectedServers.length === 0) {
        showAlert('请至少选择一台服务器', 'error');
        return;
    }
    
    const taskData = {
        name: taskName,
        command: taskCommand,
        cron_expression: taskCron,
        server_ids: selectedServers,
        is_active: true
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = '创建中...';
    
    try {
        const response = await fetch(`${API_BASE}/api/scheduled/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(taskData)
        });
        
        if (response.ok) {
            const result = await response.json();
            showAlert(`定时任务 ${result.name} 创建成功!`, 'success');
            form.reset();
            updateScheduledSelectedServers([]);
            await loadScheduledTasks();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '创建失败');
        }
    } catch (error) {
        console.error('创建定时任务失败:', error);
        showAlert(`创建定时任务失败: ${error.message}`, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 删除定时任务
async function deleteScheduledTask(taskId) {
    if (!confirm('确定要删除这个定时任务吗？')) return;
    
    const taskCard = document.querySelector(`.scheduled-task-card[data-id="${taskId}"]`);
    if (taskCard) {
        taskCard.classList.add('deleting');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/scheduled/${taskId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showAlert('定时任务删除成功!', 'success');
            await loadScheduledTasks();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '删除失败');
        }
    } catch (error) {
        console.error('删除定时任务失败:', error);
        showAlert(`删除定时任务失败: ${error.message}`, 'error');
        if (taskCard) {
            taskCard.classList.remove('deleting');
        }
    }
}

// 启用/禁用定时任务
async function toggleScheduledTask(taskId, isActive) {
    const taskCard = document.querySelector(`.scheduled-task-card[data-id="${taskId}"]`);
    if (taskCard) {
        taskCard.classList.add('updating');
    }
    
    try {
        const response = await fetch(`${API_BASE}/api/scheduled/${taskId}/toggle`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_active: isActive })
        });
        
        if (response.ok) {
            const result = await response.json();
            showAlert(`定时任务${result.is_active ? '启用' : '禁用'}成功!`, 'success');
            await loadScheduledTasks();
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '操作失败');
        }
    } catch (error) {
        console.error('更新定时任务状态失败:', error);
        showAlert(`更新定时任务状态失败: ${error.message}`, 'error');
        if (taskCard) {
            taskCard.classList.remove('updating');
        }
    }
}

// 加载任务历史
async function loadTaskHistory() {
    const historyList = document.getElementById('taskHistoryList');
    const filterSelect = document.getElementById('taskHistoryFilter');
    const filter = filterSelect ? filterSelect.value : 'all';
    
    try {
        const response = await fetch(`${API_BASE}/api/tasks/`);
        if (response.ok) {
            const tasks = await response.json();
            updateTaskHistoryList(tasks, filter);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '加载失败');
        }
    } catch (error) {
        console.error('加载任务历史失败:', error);
        showAlert(`加载任务历史失败: ${error.message}`, 'error');
        historyList.innerHTML = `<div class="alert alert-error">加载失败: ${error.message}</div>`;
    }
}

// 更新任务历史列表
function updateTaskHistoryList(tasks, filter = 'all') {
    const historyList = document.getElementById('taskHistoryList');
    historyList.innerHTML = '';
    
    // 根据筛选条件过滤任务
    let filteredTasks = tasks;
    if (filter === 'success') {
        filteredTasks = tasks.filter(task => task.success);
    } else if (filter === 'failed') {
        filteredTasks = tasks.filter(task => !task.success);
    } else if (filter === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredTasks = tasks.filter(task => new Date(task.created_at) >= today);
    } else if (filter === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredTasks = tasks.filter(task => new Date(task.created_at) >= weekAgo);
    }
    
    if (filteredTasks.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                ${filter !== 'all' ? '没有找到匹配的任务记录' : '暂无任务历史'}
                ${filter !== 'all' ? `<button class="btn" onclick="document.getElementById('taskHistoryFilter').value='all'; loadTaskHistory();">查看所有</button>` : ''}
            </div>
        `;
        return;
    }
    
    // 按时间排序，最新的在前面
    filteredTasks.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    filteredTasks.forEach(task => {
        const taskCard = document.createElement('div');
        taskCard.className = `task-history-card ${task.success ? 'success' : 'error'}`;
        taskCard.dataset.id = task.id;
        
        const createdAt = new Date(task.created_at).toLocaleString();
        const executionTime = task.execution_time ? `${task.execution_time.toFixed(2)}秒` : '未知';
        
        taskCard.innerHTML = `
            <div class="task-header">
                <h4>${task.command}</h4>
                <div class="task-status">
                    <span class="status-badge ${task.success ? 'success' : 'error'}">
                        ${task.success ? '成功' : '失败'}
                    </span>
                </div>
            </div>
            <div class="task-body">
                <div class="task-info">
                    <p><strong>执行时间:</strong> ${createdAt}</p>
                    <p><strong>耗时:</strong> ${executionTime}</p>
                    <p><strong>服务器:</strong> ${task.server_count}台</p>
                </div>
                <div class="task-actions">
                    <button class="btn btn-sm" onclick="viewTaskDetail(${task.id})">查看详情</button>
                </div>
            </div>
        `;
        
        historyList.appendChild(taskCard);
    });
}

// 查看任务详情
async function viewTaskDetail(taskId) {
    try {
        const response = await fetch(`${API_BASE}/api/tasks/${taskId}`);
        if (response.ok) {
            const task = await response.json();
            showTaskDetailModal(task);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.detail || '加载失败');
        }
    } catch (error) {
        console.error('加载任务详情失败:', error);
        showAlert(`加载任务详情失败: ${error.message}`, 'error');
    }
}

// 显示任务详情模态框
function showTaskDetailModal(task) {
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>任务详情</h3>
                <button class="close-btn" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="task-detail-header">
                    <h4>命令: <code>${task.command}</code></h4>
                    <p><strong>执行时间:</strong> ${new Date(task.created_at).toLocaleString()}</p>
                    <p><strong>总耗时:</strong> ${task.execution_time ? `${task.execution_time.toFixed(2)}秒` : '未知'}</p>
                    <p><strong>总体状态:</strong> <span class="status-badge ${task.success ? 'success' : 'error'}">${task.success ? '成功' : '失败'}</span></p>
                </div>
                <div class="task-results">
                    <h4>执行结果 (${task.results.length}台服务器)</h4>
                    ${task.results.map(result => `
                        <div class="server-result ${result.success ? 'success' : 'error'}">
                            <div class="server-info">
                                <h5>${result.server_name} (${result.server_host})</h5>
                                <span class="status-badge ${result.success ? 'success' : 'error'}">
                                    ${result.success ? '成功' : '失败'}
                                </span>
                            </div>
                            <div class="result-content">
                                ${result.success ? `
                                    <div class="output">
                                        <h6>输出:</h6>
                                        <pre>${result.output || '(无输出)'}</pre>
                                    </div>
                                ` : `
                                    <div class="error-message">
                                        <h6>错误:</h6>
                                        <pre>${result.error || '未知错误'}</pre>
                                    </div>
                                `}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn" onclick="this.closest('.modal').remove()">关闭</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加ESC键关闭模态框
    const closeOnEsc = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEsc);
        }
    };
    document.addEventListener('keydown', closeOnEsc);
    
    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
            document.removeEventListener('keydown', closeOnEsc);
        }
    });
}