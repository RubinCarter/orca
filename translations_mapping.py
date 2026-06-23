#!/usr/bin/env python3
"""
Translation mapping for zh.json i18n file.
This maps English strings to their Chinese translations.
"""

TRANSLATIONS = {
    # auto.components.GitHubItemDialog
    "comment L": "评论 L",
    "page": "页面",
    "sheet": "表格",
    "destructive": "危险操作",
    
    # auto.components.Landing
    "ORCA": "ORCA",
    
    # auto.components.LinearIssueMarkdownDescriptionEditor
    "Markdown": "Markdown",
    
    # auto.components.LinearIssueWorkspace
    "Linear": "Linear",
    
    # auto.components.NewWorkspaceComposerCard
    "Agent": "Agent",
    "yaml": "yaml",
    
    # auto.components.PullRequestPage
    
    # auto.components.QuickOpen
    "ripgrep": "ripgrep",
    
    # auto.components.ShortcutKeyCombo
    "Double-tap {{value0}}": "双击 {{value0}}",
    
    # auto.components.StarNagCard
    "gh": "gh",
    
    # auto.components.TaskPage
    "GitLab": "GitLab",
    "https://example.atlassian.net": "https://example.atlassian.net",
    "mrs": "MR 列表",
    "github": "GitHub",
    "Details": "详情",
    "Linear": "Linear",
    "Jira": "Jira",
    "MR !{{value0}}": "MR !{{value0}}",
    "GitHub": "GitHub",
    "mr": "MR",
    "...": "...",
    "MR": "MR",
    "ID": "ID",
    
    # auto.components.Terminal
    "No agent CLI detected — install one or pick a default agent in Settings.": "未检测到 Agent CLI — 请安装一个或在设置中选择默认 Agent。",
    "Could not build launch command for {{value0}}.": "无法为 {{value0}} 构建启动命令。",
    
    # auto.components.activity.ActivityPrototypePage
    
    # auto.components.activity.ActivityTitlebarControls
    
    # auto.components.agent.AgentSettingsDialog
    "Agents": "Agents",
    
    # auto.components.automations.AutomationDetail
    "Source": "来源",
    "Agent": "Agent",
    
    # auto.components.automations.AutomationEditorDialog
    
    # auto.components.automations.AutomationEditorDialogHeader
    "Orca": "Orca",
    "Hermes": "Hermes",
    
    # auto.components.automations.AutomationPrecheckFields
    "gh pr list --json number -q '.[0].number'": "gh pr list --json number -q '.[0].number'",
    
    # auto.components.automations.AutomationProjectCombobox
    "Add project": "添加项目",
    "Adding project…": "正在添加项目…",
    "Choose automation host": "选择自动化主机",
    "No projects/folders match your search.": "没有匹配的项目/文件夹。",
    "Search projects/folders...": "搜索项目/文件夹...",
    
    # auto.components.automations.AutomationsPage
    "Retry source": "重试来源",
    "Automation source refreshed.": "自动化来源已刷新。",
    
    # auto.components.browser.pane.BrowserPane
    "Could not open the downloaded file. It may have been moved or deleted.": "无法打开下载的文件。文件可能已被移动或删除。",
    "Could not show the downloaded file. It may have been moved or deleted.": "无法显示下载的文件。文件可能已被移动或删除。",
    "Downloading paused": "下载已暂停",
    "Download failed": "下载失败",
    "The downloaded file path is unavailable.": "下载的文件路径不可用。",
    
    # auto.components.crash.report.CrashReportDialog
    "Attach recent diagnostic logs": "附加最近的诊断日志",
    "Failed to send crash report. Diagnostic ticket {{value0}} was uploaded but not linked.": "发送崩溃报告失败。诊断工单 {{value0}} 已上传但未关联。",
    "Sends a capped redacted log bundle with the report.": "随报告发送有限制的脱敏日志包。",
    "No automatic crash report was captured. You can still send details and include recent diagnostic logs when available.": "未捕获到自动崩溃报告。您仍然可以发送详细信息，并在可用时包含最近的诊断日志。",
    
    # auto.components.editor.CheckRunDetailsPanel
    "Failed jobs": "失败的作业",
    "No details are available for this check.": "此检查没有可用的详细信息。",
    "Loading check details…": "正在加载检查详情…",
    "workflow #": "工作流 #",
    "Timed out": "已超时",
    "Fix with AI": "使用 AI 修复",
    "Open details": "打开详情",
    
    # auto.components.editor.ComposerDiffViewer
    "The diff did not apply cleanly.": "差异未干净应用。",
    "Open in Editor": "在编辑器中打开",
    "Open Diff": "打开差异",
    "Your conflict markers are visible in the editor.": "您的冲突标记在编辑器中可见。",
    
    # auto.components.editor.EditorComponents
    "Line {{line}}": "第 {{line}} 行",
    "Column {{column}}": "第 {{column}} 列",
    
    # auto.components.editor.EditorDiffReviewPanel
    "Diff preview unavailable for new files.": "新文件的差异预览不可用。",
    "No diff is available because the worktree HEAD cannot be resolved.": "无法解析工作树 HEAD，因此差异不可用。",
    
    # auto.components.editor.EditorOpenFiles
    "Clear": "清除",
    "Recent Files": "最近文件",
    "Open Files": "打开的文件",
    
    # auto.components.editor.EditorTabOverflowMenu
    "Close All Tabs": "关闭所有标签页",
    "Close Unchanged Tabs": "关闭未更改的标签页",
    "Close Tabs to the Right": "关闭右侧标签页",
    
    # auto.components.editor.EditorTabTooltipContent
    "Modified": "已修改",
    "Unmodified": "未修改",
    
    # auto.components.editor.EditorTerminalPane
    "Edit the command before sending to the terminal.": "在发送到终端之前编辑命令。",
    "Click to send this command to the terminal.": "点击将此命令发送到终端。",
    
    # auto.components.editor.FileBreadcrumb
    "Copy file name": "复制文件名",
    "Copy path": "复制路径",
    "Copy relative path": "复制相对路径",
    "Copy workspace path": "复制工作区路径",
    "Show in {{value0}}": "在 {{value0}} 中显示",
    "Show in Finder": "在 Finder 中显示",
    "Show in File Explorer": "在文件资源管理器中显示",
    
    # auto.components.editor.FileTree
    "{{label}} is out of the workspace.": "{{label}} 在工作区之外。",
    "{{label}} is ignored by the workspace.": "{{label}} 被工作区忽略。",
    "{{label}} is excluded by the workspace.": "{{label}} 被工作区排除。",
    "Collapse all folders": "折叠所有文件夹",
    "Create New...": "新建...",
    "Expand all folders": "展开所有文件夹",
    "File tree view is not available on mobile devices.": "文件树视图在移动设备上不可用。",
    "New File...": "新建文件...",
    "New Folder...": "新建文件夹...",
    "Open Folder in New Window": "在新窗口中打开文件夹",
    "Refresh file tree": "刷新文件树",
    "Reveal in {{value0}}": "在 {{value0}} 中显示",
    "Reveal in Finder": "在 Finder 中显示",
    "Reveal in File Explorer": "在文件资源管理器中显示",
    "Sync file tree with editor": "将文件树与编辑器同步",
    "There is no parent folder to create this file in.": "没有父文件夹来创建此文件。",
    "To-do tasks for agents from code comments.": "来自代码注释的 Agent 待办任务。",
    
    # auto.components.editor.GitDecorationBadge
    "Added": "已添加",
    "Conflict": "冲突",
    "Copied": "已复制",
    "Deleted": "已删除",
    "Ignored": "已忽略",
    "Modified": "已修改",
    "Renamed": "已重命名",
    "Submodule": "子模块",
    "Untracked": "未跟踪",
    
    # auto.components.editor.GitDiffEditor
    "Can\'t find original file to compare with": "找不到原始文件进行比较",
    "Open {{filePath}} failed": "打开 {{filePath}} 失败",
    
    # auto.components.editor.ImageEditor
    "Open in Browser": "在浏览器中打开",
    "Open in default app": "在默认应用中打开",
    "Reveal in {{value0}}": "在 {{value0}} 中显示",
    "Reveal in Finder": "在 Finder 中显示",
    "Reveal in File Explorer": "在文件资源管理器中显示",
    
    # auto.components.editor.ItemBreadcrumbNavigation
    "Loading...": "加载中...",
    
    # auto.components.editor.NoPreviewPanel
    "Select a file to see its preview": "选择文件以查看预览",
    
    # auto.components.editor.PRDescriptionPreviewPanel
    "This PR has no description.": "此 PR 没有描述。",
    
    # auto.components.editor.SimpleBrowserView
    "Open Image in New Tab": "在新标签页中打开图片",
    "Open in New Tab": "在新标签页中打开",
    
    # auto.components.editor.SlickDragHandle
    "Drag to reorder": "拖动以重新排序",
    
    # auto.components.editor.TodoPanel
    "Fetch": "获取",
    "Fetch latest": "获取最新",
    "Fetching...": "正在获取...",
    "Showing to-dos across all files.": "显示所有文件中的待办事项。",
    "Showing to-dos from the currently open file.": "显示当前打开文件的待办事项。",
    "Toggle to view to-dos from just the open file or all files.": "切换以仅查看打开文件或所有文件的待办事项。",
    "Todos": "待办事项",
    
    # auto.components.editor.WorkspaceConflictRibbon
    "<strong>{{conflictCount}}</strong> conflicted files found in workspace": "在工作区中发现 <strong>{{conflictCount}}</strong> 个冲突文件",
    "<strong>{{conflictCount}}</strong> conflicted file found in workspace": "在工作区中发现 <strong>{{conflictCount}}</strong> 个冲突文件",
    "Resolve": "解决",
    
    # auto.components.git.CommitGenerationReview
    "Commit message did not apply cleanly.": "提交消息未干净应用。",
    "Diffs used in message": "消息中使用的差异",
    "Edit commit message before applying": "在应用前编辑提交消息",
    "Message generation cancelled.": "消息生成已取消。",
    "No diffs": "无差异",
    "Open in Diff Viewer": "在差异查看器中打开",
    "Regenerate": "重新生成",
    "Select diffs": "选择差异",
    "Undo model change": "撤销模型更改",
    
    # auto.components.git.CommitReviewDialog
    "Commit changes": "提交更改",
    "Regenerate commit message": "重新生成提交消息",
    "Staged changes": "暂存的更改",
    "Unstaged changes": "未暂存的更改",
    
    # auto.components.git.CommitView
    "Stage changes before committing": "在提交前暂存更改",
    
    # auto.components.git.ConflictsPanel
    "Mark resolved": "标记为已解决",
    "Open": "打开",
    "Resolve in Editor": "在编辑器中解决",
    "Unresolved": "未解决",
    
    # auto.components.git.CreatePRPage
    "Branch not published": "分支未发布",
    "Create a pull request on GitHub": "在 GitHub 上创建拉取请求",
    "Create a merge request on GitLab": "在 GitLab 上创建合并请求",
    "Draft": "草稿",
    "Error checking branch status: {{message}}": "检查分支状态时出错：{{message}}",
    "Failed to check branch diff": "检查分支差异失败",
    "Failed to create merge request": "创建合并请求失败",
    "Failed to create pull request": "创建拉取请求失败",
    "Loading branch status...": "正在加载分支状态...",
    "Merge request created": "合并请求已创建",
    "No commits to push": "没有可推送的提交",
    "Pull request created": "拉取请求已创建",
    "Push changes first": "先推送更改",
    "Template": "模板",
    "Title": "标题",
    
    # auto.components.git.GitCommitToolbar
    "Commit": "提交",
    "Commit failed": "提交失败",
    "Commit message": "提交消息",
    "Failed to commit": "提交失败",
    "Generate commit message": "生成提交消息",
    "Generating commit message...": "正在生成提交消息...",
    "No commit": "无提交",
    "No staged changes": "没有暂存的更改",
    "Stage and commit": "暂存并提交",
    "Staged": "已暂存",
    "Unstage and keep changes": "取消暂存并保留更改",
    
    # auto.components.git.GitPanel
    "{{value0}} ahead": "领先 {{value0}}",
    "{{value0}} behind": "落后 {{value0}}",
    "{{value0}} commits": "{{value0}} 个提交",
    "{{value0}} file changed": "{{value0}} 个文件已更改",
    "{{value0}} files changed": "{{value0}} 个文件已更改",
    "1 commit": "1 个提交",
    "Ahead": "领先",
    "Behind": "落后",
    "Changes": "更改",
    "Clear filters": "清除筛选",
    "Copy GitHub Permalink": "复制 GitHub 永久链接",
    "Copy {{provider}} Permalink": "复制 {{provider}} 永久链接",
    "Create PR": "创建 PR",
    "Create a pull request for the current branch": "为当前分支创建拉取请求",
    "Dismiss notification": "关闭通知",
    "Fetch failed": "获取失败",
    "Fetching...": "正在获取...",
    "Filter files...": "筛选文件...",
    "Generate commit message with {{modelName}}": "使用 {{modelName}} 生成提交消息",
    "Merge commit detected": "检测到合并提交",
    "More actions": "更多操作",
    "No Git repository detected in this workspace.": "此工作区中未检测到 Git 仓库。",
    "No changes": "无更改",
    "Open commit generation model settings": "打开提交生成模型设置",
    "Open diff": "打开差异",
    "Open repository settings": "打开仓库设置",
    "Pull ({{value0}}) failed": "拉取 ({{value0}}) 失败",
    "Pull ({{value0}}) succeeded": "拉取 ({{value0}}) 成功",
    "Pull failed": "拉取失败",
    "Pull from {{value0}} failed": "从 {{value0}} 拉取失败",
    "Pull from {{value0}} succeeded": "从 {{value0}} 拉取成功",
    "Pull succeeded": "拉取成功",
    "Pulling...": "正在拉取...",
    "Push ({{value0}}) failed": "推送 ({{value0}}) 失败",
    "Push ({{value0}}) succeeded": "推送 ({{value0}}) 成功",
    "Push failed": "推送失败",
    "Push succeeded": "推送成功",
    "Pushing...": "正在推送...",
    "Repository settings": "仓库设置",
    "Stage all changes": "暂存所有更改",
    "Stage changes": "暂存更改",
    "Stash changes": "贮藏更改",
    "Switch to branch...": "切换到分支...",
    "Sync failed": "同步失败",
    "Sync with {{remote}} failed": "与 {{remote}} 同步失败",
    "Sync with {{remote}} succeeded": "与 {{remote}} 同步成功",
    "Syncing...": "正在同步...",
    "Unstage all changes": "取消暂存所有更改",
    "Unstage changes": "取消暂存更改",
    "View source control AI settings": "查看源代码控制 AI 设置",
    
    # auto.components.git.GitPanelBranchRow
    "{{ahead}} ahead, {{behind}} behind": "领先 {{ahead}}，落后 {{behind}}",
    "Delete branch": "删除分支",
    "Push branch": "推送分支",
    "Rename branch": "重命名分支",
    "Switch to branch": "切换到分支",
    
    # auto.components.git.GitPanelConflictFileItem
    "Merge conflicts in {{value0}}": "{{value0}} 中的合并冲突",
    "Resolve": "解决",
    
    # auto.components.git.GitPanelHeader
    "All files": "所有文件",
    "Conflicts": "冲突",
    "Staged": "已暂存",
    "Unstaged": "未暂存",
    
    # auto.components.git.GitPanelRemoteRow
    "Copy GitHub Permalink": "复制 GitHub 永久链接",
    "Fetch": "获取",
    "Prune": "清理",
    "Pull": "拉取",
    "Push": "推送",
    
    # auto.components.git.GitPanelStashItem
    "Apply stash": "应用贮藏",
    "Drop stash": "丢弃贮藏",
    "Pop stash": "弹出贮藏",
    "Stash created": "贮藏已创建",
    "Stash dropped": "贮藏已丢弃",
    
    # auto.components.git.GitRemoteConfigDialog
    "Add remote": "添加远程",
    "Branch is protected": "分支受保护",
    "Configure remotes": "配置远程",
    "Default branch is protected": "默认分支受保护",
    "Delete remote": "删除远程",
    "Force push disabled": "强制推送已禁用",
    "Git remote configuration": "Git 远程配置",
    "Main branch is protected": "主分支受保护",
    "Remote URL": "远程 URL",
    "Remote name": "远程名称",
    "Remotes": "远程",
    "Save changes": "保存更改",
    
    # auto.components.git.MergeConflictResolutionDialog
    "Accept Current": "接受当前",
    "Accept Incoming": "接受传入",
    "Accept both": "全部接受",
    "Accept combination": "接受组合",
    "Accept current": "接受当前",
    "Accept incoming": "接受传入",
    "Both": "全部",
    "Choose how to resolve the conflict": "选择如何解决冲突",
    "Current ({{branch}})": "当前 ({{branch}})",
    "Incoming ({{branch}})": "传入 ({{branch}})",
    "Jump to next conflict": "跳转到下一个冲突",
    "Keep both versions": "保留两个版本",
    "Keep current version": "保留当前版本",
    "Keep incoming version": "保留传入版本",
    "Next": "下一个",
    "Previous": "上一个",
    "Resolve": "解决",
    "Use AI to resolve": "使用 AI 解决",
    "Using AI...": "正在使用 AI...",
    
    # auto.components.git.PrList
    "All": "全部",
    "Check runs": "检查运行",
    "Check runs failed": "检查运行失败",
    "Check runs passed": "检查运行通过",
    "Check runs pending": "检查运行待处理",
    "Created {{value0}}": "创建于 {{value0}}",
    "Draft": "草稿",
    "Failed to load pull requests": "加载拉取请求失败",
    "Filter...": "筛选...",
    "Linked worktree": "链接的工作树",
    "Merged": "已合并",
    "No pull requests found": "未找到拉取请求",
    "Open": "打开",
    "Updated {{value0}}": "更新于 {{value0}}",
    
    # auto.components.git.PrListFilter
    "{{count}} PRs": "{{count}} 个 PR",
    "1 PR": "1 个 PR",
    "No PRs": "无 PR",
    "Sort by": "排序方式",
    
    # auto.components.git.PullRequestReviewToolbar
    "Add single comment": "添加单条评论",
    "Add to review": "添加到审阅",
    "Approve": "批准",
    "Approving...": "正在批准...",
    "Comment": "评论",
    "Commenting...": "正在评论...",
    "Request changes": "请求更改",
    "Requesting changes...": "正在请求更改...",
    "Review summary": "审阅摘要",
    "Start a review": "开始审阅",
    "Submit review": "提交审阅",
    "Submitting review...": "正在提交审阅...",
    
    # auto.components.git.PushButton
    "Push {{value0}} commit": "推送 {{value0}} 个提交",
    "Push {{value0}} commits": "推送 {{value0}} 个提交",
    
    # auto.components.git.RemoteBranchInfo
    "Remote branch not found": "未找到远程分支",
    
    # auto.components.git.StashDialog
    "Include untracked files": "包含未跟踪的文件",
    "Message": "消息",
    "Stash": "贮藏",
    "Stash changes": "贮藏更改",
    
    # auto.components.git.SyncButton
    "Force push": "强制推送",
    "Pull": "拉取",
    "Push": "推送",
    "Sync": "同步",
    
    # auto.components.git.modals.BranchRenameModal
    "Branch rename": "分支重命名",
    "Cancel": "取消",
    "Failed to rename branch": "重命名分支失败",
    "Rename": "重命名",
    "Renaming...": "正在重命名...",
    
    # auto.components.git.modals.DeleteBranchModal
    "Cancel": "取消",
    "Delete branch": "删除分支",
    "Delete branch {{branch}}": "删除分支 {{branch}}",
    "Delete local and remote": "删除本地和远程",
    "Delete local only": "仅删除本地",
    "Deleting...": "正在删除...",
    "Failed to delete branch": "删除分支失败",
    "Force delete": "强制删除",
    "This branch has unmerged changes.": "此分支有未合并的更改。",
    
    # auto.components.git.modals.MergeBranchModal
    "Cancel": "取消",
    "Create a merge commit": "创建合并提交",
    "Failed to merge": "合并失败",
    "Merge": "合并",
    "Merge {{source}} into {{target}}": "将 {{source}} 合并到 {{target}}",
    "Merging...": "正在合并...",
    "Squash and merge": "压缩并合并",
    
    # auto.components.git.modals.PullModal
    "Cancel": "取消",
    "Fast-forward only": "仅快进",
    "Fetch only": "仅获取",
    "No fast-forward": "不快进",
    "Pull": "拉取",
    "Pull {{remote}}/{{branch}}": "拉取 {{remote}}/{{branch}}",
    "Pulling...": "正在拉取...",
    "Rebase": "变基",
    
    # auto.components.git.modals.PushModal
    "Cancel": "取消",
    "Force push": "强制推送",
    "Push": "推送",
    "Push {{remote}}/{{branch}}": "推送 {{remote}}/{{branch}}",
    "Pushing...": "正在推送...",
    "Set upstream": "设置上游",
    
    # auto.components.landing.GettingStartedCard
    "Continue onboarding": "继续入门引导",
    "Dismiss": "关闭",
    "Get started with Orca": "开始使用 Orca",
    "Getting Started": "入门引导",
    "Restart onboarding": "重新开始入门引导",
    "You're almost there!": "就快完成了！",
    
    # auto.components.mobile.AdbDeviceSelector
    "No devices found": "未找到设备",
    "Select a device": "选择设备",
    
    # auto.components.mobile.DeviceSelector
    "Connect to device": "连接到设备",
    "Failed to connect to {{value0}}": "连接到 {{value0}} 失败",
    "No device selected": "未选择设备",
    "Scanning for devices...": "正在扫描设备...",
    
    # auto.components.mobile.MobileDevicePanel
    "Battery": "电池",
    "Connected": "已连接",
    "Connecting...": "正在连接...",
    "Connection failed": "连接失败",
    "Disconnect": "断开连接",
    "Disconnected": "已断开",
    "Model": "型号",
    "No device connected": "未连接设备",
    "OS Version": "操作系统版本",
    "Screen": "屏幕",
    "Start session": "开始会话",
    
    # auto.components.mobile.MobileDevicePanelSessionList
    "Active": "活跃",
    "Create session": "创建会话",
    "Last active": "最后活跃",
    "No sessions": "无会话",
    "Session": "会话",
    "Sessions": "会话",
    
    # auto.components.mobile.MobileEmulatorDevice
    "Connect via USB": "通过 USB 连接",
    "Connection instructions": "连接说明",
    "Enable USB debugging": "启用 USB 调试",
    "Open device settings": "打开设备设置",
    "Open developer options": "打开开发者选项",
    "Tap 'Build number' 7 times": "点击"版本号"7 次",
    
    # auto.components.mobile.MobileEmulatorSettings
    "A new iOS version is available for download.": "有新的 iOS 版本可供下载。",
    "Android emulator": "Android 模拟器",
    "Android emulator path": "Android 模拟器路径",
    "Booting simulator...": "正在启动模拟器...",
    "Checking for iOS updates...": "正在检查 iOS 更新...",
    "Create simulator": "创建模拟器",
    "Device Type": "设备类型",
    "Download iOS {{version}}": "下载 iOS {{version}}",
    "Downloading iOS {{version}}...": "正在下载 iOS {{version}}...",
    "iOS Simulator": "iOS 模拟器",
    "iOS simulator runtime": "iOS 模拟器运行时",
    "No Android emulator found": "未找到 Android 模拟器",
    "No iOS simulators found": "未找到 iOS 模拟器",
    "OS Version": "操作系统版本",
    "Simulator name": "模拟器名称",
    
    # auto.components.mobile.MobileSessionPanel
    "End session": "结束会话",
    "No active session": "无活跃会话",
    "Resume session": "恢复会话",
    
    # auto.components.modals.ChangeBaseBranchDialog
    "Base branch": "基础分支",
    "Change base": "更改基础",
    "Change the target branch for this PR": "更改此 PR 的目标分支",
    "Current: {{branch}}": "当前：{{branch}}",
    
    # auto.components.modals.InputDialog
    "Cancel": "取消",
    "Confirm": "确认",
    
    # auto.components.modals.MobileDeviceAuthDialog
    "Allow USB debugging?": "允许 USB 调试吗？",
    "Always allow from this computer": "始终允许来自此计算机",
    "Cancel": "取消",
    "Fingerprint": "指纹",
    "OK": "确定",
    "RSA key fingerprint": "RSA 密钥指纹",
    
    # auto.components.modals.NewBranchDialog
    "Cancel": "取消",
    "Checkout branch": "检出分支",
    "Create and switch": "创建并切换",
    "Create branch": "创建分支",
    "Creating...": "正在创建...",
    "Failed to create branch": "创建分支失败",
    
    # auto.components.modals.OrchestrationHandoffDialog
    "Cancel": "取消",
    "Hand off task": "移交任务",
    "Handoff": "移交",
    "Orchestration handoff": "编排移交",
    "Select target worktree": "选择目标工作树",
    
    # auto.components.onboarding.OnboardingChecklist
    "Add a project to get started": "添加项目以开始",
    "Add your first project": "添加您的第一个项目",
    "Check for updates": "检查更新",
    "Connect to GitHub": "连接到 GitHub",
    "Connect to {{value0}}": "连接到 {{value0}}",
    "Create a workspace": "创建工作区",
    "Customize keyboard shortcuts": "自定义键盘快捷键",
    "Enable AI-powered commit messages": "启用 AI 驱动的提交消息",
    "Getting started checklist": "入门清单",
    "Install Orca CLI": "安装 Orca CLI",
    "Invite team members": "邀请团队成员",
    "Learn about agents": "了解 Agents",
    "Optional": "可选",
    "Set up mobile development": "设置移动开发",
    "Set up orchestration": "设置编排",
    "Set up source control": "设置源代码控制",
    "Set up SSH connections": "设置 SSH 连接",
    "Set up your first automation": "设置您的第一个自动化",
    "Try AI-powered features": "尝试 AI 驱动的功能",
    
    # auto.components.onboarding.OnboardingModal
    "Continue": "继续",
    "Get started": "开始",
    "Next": "下一步",
    "Previous": "上一步",
    "Skip": "跳过",
    "Welcome to Orca": "欢迎使用 Orca",
    
    # auto.components.orchestration.OrchestrationPanel
    "Active handoffs": "活跃移交",
    "Completed handoffs": "已完成移交",
    "No active handoffs": "无活跃移交",
    "No completed handoffs": "无已完成移交",
    "Orchestration": "编排",
    
    # auto.components.orchestration.OrchestrationUsageExamples
    "Split a large change into smaller PRs": "将大型更改拆分为较小的 PR",
    "Run independent work in parallel": "并行运行独立工作",
    "Run a phased workflow": "运行分阶段工作流",
    "Hand off to another worktree": "移交给另一个工作树",
    "Hand off an active task": "移交活跃任务",
    
    # auto.components.ports.PortsPanel
    "Add external listener": "添加外部监听器",
    "Copy URL": "复制 URL",
    "External listeners": "外部监听器",
    "No ports found": "未找到端口",
    "Open in browser": "在浏览器中打开",
    "Port": "端口",
    "Port {{port}}": "端口 {{port}}",
    "Ports": "端口",
    "Process": "进程",
    "Workspace ports": "工作区端口",
    
    # auto.components.settings.SettingsAiProviders
    "Add provider": "添加提供商",
    "API key": "API 密钥",
    "API Key": "API 密钥",
    "API endpoint": "API 端点",
    "Authentication": "认证",
    "Azure OpenAI": "Azure OpenAI",
    "Base URL": "基础 URL",
    "Choose a provider": "选择提供商",
    "Configure {{provider}}": "配置 {{provider}}",
    "Custom": "自定义",
    "Custom provider": "自定义提供商",
    "Default": "默认",
    "Delete provider": "删除提供商",
    "Disable provider": "禁用提供商",
    "Enable provider": "启用提供商",
    "Gemini API key": "Gemini API 密钥",
    "Google AI Studio": "Google AI Studio",
    "Model": "模型",
    "Model ID": "模型 ID",
    "Models": "模型",
    "No providers configured": "未配置提供商",
    "Organization ID": "组织 ID",
    "Provider name": "提供商名称",
    "Remove provider": "移除提供商",
    "Save changes": "保存更改",
    "Select default model": "选择默认模型",
    "Settings saved": "设置已保存",
    "Test connection": "测试连接",
    "Vertex AI": "Vertex AI",
    
    # auto.components.settings.SettingsAppearance
    "Compact": "紧凑",
    "Dark": "深色",
    "Font family": "字体族",
    "Font size": "字体大小",
    "Interface density": "界面密度",
    "Language": "语言",
    "Light": "浅色",
    "Line height": "行高",
    "Show line numbers": "显示行号",
    "Sidebar width": "侧边栏宽度",
    "System": "系统",
    "Theme": "主题",
    "Zoom level": "缩放级别",
    
    # auto.components.settings.SettingsBrowser
    "Clear browsing data": "清除浏览数据",
    "Clear cache": "清除缓存",
    "Clear cookies": "清除 Cookie",
    "Clear history": "清除历史记录",
    "Default browser profile": "默认浏览器配置文件",
    "Default search engine": "默认搜索引擎",
    "Download location": "下载位置",
    "Open downloads in": "在以下位置打开下载",
    "Startup page": "启动页面",
    
    # auto.components.settings.SettingsGeneral
    "Application": "应用",
    "Auto-update": "自动更新",
    "Check for updates": "检查更新",
    "Confirm before closing": "关闭前确认",
    "Data directory": "数据目录",
    "Default editor": "默认编辑器",
    "Default worktree location": "默认工作树位置",
    "Enable crash reporting": "启用崩溃报告",
    "Enable telemetry": "启用遥测",
    "Language": "语言",
    "Open data directory": "打开数据目录",
    "Send anonymous usage data": "发送匿名使用数据",
    "Show release notes on update": "更新时显示发布说明",
    "Version": "版本",
    
    # auto.components.settings.SettingsGit
    "Allow force push": "允许强制推送",
    "Author email": "作者邮箱",
    "Author name": "作者名称",
    "Auto-fetch interval": "自动获取间隔",
    "Default branch": "默认分支",
    "Default remote": "默认远程",
    "Enable AI commit messages": "启用 AI 提交消息",
    "Enable GPG signing": "启用 GPG 签名",
    "Enable merge commits": "启用合并提交",
    "Git configuration": "Git 配置",
    "Never": "从不",
    "Sign commits": "签名提交",
    
    # auto.components.settings.SettingsIntegrations
    "Azure DevOps": "Azure DevOps",
    "Bitbucket": "Bitbucket",
    "Connect": "连接",
    "Connected": "已连接",
    "Connecting...": "正在连接...",
    "Connection failed": "连接失败",
    "Disconnect": "断开连接",
    "GitHub": "GitHub",
    "GitLab": "GitLab",
    "Integration settings": "集成设置",
    "Jira": "Jira",
    "Linear": "Linear",
    "Not connected": "未连接",
    "Reconnect": "重新连接",
    
    # auto.components.settings.SettingsKeyboardShortcuts
    "Add custom shortcut": "添加自定义快捷键",
    "Chord": "组合键",
    "Customize shortcuts": "自定义快捷键",
    "Keybinding": "按键绑定",
    "Remove shortcut": "移除快捷键",
    "Reset to default": "重置为默认值",
    "Reset all shortcuts": "重置所有快捷键",
    "Shortcut": "快捷键",
    
    # auto.components.settings.SettingsMobile
    "ADB path": "ADB 路径",
    "Android SDK path": "Android SDK 路径",
    "Configure Android emulator": "配置 Android 模拟器",
    "Configure iOS simulator": "配置 iOS 模拟器",
    "Mobile development": "移动开发",
    "Xcode path": "Xcode 路径",
    
    # auto.components.settings.SettingsNotifications
    "Enable notifications": "启用通知",
    "Notification settings": "通知设置",
    "Notify on agent completion": "Agent 完成时通知",
    "Notify on build completion": "构建完成时通知",
    "Notify on task completion": "任务完成时通知",
    "Show notification badges": "显示通知标记",
    
    # auto.components.settings.SettingsOrchestration
    "Agent timeout": "Agent 超时",
    "Enable orchestration": "启用编排",
    "Handoff settings": "移交设置",
    "Max concurrent agents": "最大并发 Agent 数",
    "Orchestration settings": "编排设置",
    
    # auto.components.settings.SettingsSSH
    "Add SSH host": "添加 SSH 主机",
    "Configure SSH": "配置 SSH",
    "Default SSH key": "默认 SSH 密钥",
    "Host": "主机",
    "Hostname": "主机名",
    "Identity file": "身份文件",
    "Port": "端口",
    "Remove host": "移除主机",
    "SSH hosts": "SSH 主机",
    "SSH settings": "SSH 设置",
    "Test connection": "测试连接",
    "User": "用户",
    
    # auto.components.settings.SettingsSourceControl
    "AI commit message model": "AI 提交消息模型",
    "AI provider": "AI 提供商",
    "Enable AI features": "启用 AI 功能",
    "Source control AI": "源代码控制 AI",
    
    # auto.components.settings.SettingsTerminal
    "Auto-close terminal": "自动关闭终端",
    "Copy on select": "选择时复制",
    "Cursor style": "光标样式",
    "Default shell": "默认 Shell",
    "Enable bell": "启用提示音",
    "Font family": "字体族",
    "Font size": "字体大小",
    "Line height": "行高",
    "Scrollback": "回滚",
    "Terminal settings": "终端设置",
    
    # auto.components.settings.SettingsWorkbench
    "Activity bar": "活动栏",
    "Enable animations": "启用动画",
    "Enable breadcrumbs": "启用面包屑",
    "Enable minimap": "启用迷你地图",
    "Enable preview": "启用预览",
    "Enable word wrap": "启用自动换行",
    "Show file icons": "显示文件图标",
    "Show folder icons": "显示文件夹图标",
    "Show git decorations": "显示 Git 装饰",
    "Show status bar": "显示状态栏",
    "Show tab close buttons": "显示标签页关闭按钮",
    "Show tabs": "显示标签页",
    "Side panel": "侧面板",
    "Tab sizing": "标签页大小",
    "Workbench settings": "工作台设置",
    
    # auto.components.shortcuts.ShortcutsDialog
    "Close": "关闭",
    "Keyboard shortcuts": "键盘快捷键",
    "Search shortcuts...": "搜索快捷键...",
    
    # auto.components.sidebar.SidebarActivityView
    "Activity": "活动",
    "Filter...": "筛选...",
    
    # auto.components.sidebar.SidebarAutomationsView
    "Automations": "自动化",
    "Filter automations...": "筛选自动化...",
    "New automation": "新建自动化",
    
    # auto.components.sidebar.SidebarGitView
    "Source Control": "源代码控制",
    
    # auto.components.sidebar.SidebarOrchestrationView
    "Orchestration": "编排",
    
    # auto.components.sidebar.SidebarPortsView
    "Ports": "端口",
    
    # auto.components.sidebar.SidebarSkillsView
    "Skills": "技能",
    
    # auto.components.sidebar.SidebarTasksView
    "Tasks": "任务",
    
    # auto.components.skills.SkillDetail
    "Configure": "配置",
    "Dependencies": "依赖",
    "Documentation": "文档",
    "Install": "安装",
    "Install skill": "安装技能",
    "Installed": "已安装",
    "Installing...": "正在安装...",
    "Not installed": "未安装",
    "Required": "必需",
    "Skill details": "技能详情",
    "Uninstall": "卸载",
    "Version": "版本",
    
    # auto.components.skills.SkillList
    "All skills": "所有技能",
    "Community": "社区",
    "Filter skills...": "筛选技能...",
    "Installed": "已安装",
    "Official": "官方",
    
    # auto.components.tasks.TaskDetail
    "Assignee": "负责人",
    "Cancel": "取消",
    "Completed": "已完成",
    "Created": "创建",
    "Description": "描述",
    "Due date": "截止日期",
    "Edit": "编辑",
    "Failed": "失败",
    "In progress": "进行中",
    "Labels": "标签",
    "Priority": "优先级",
    "Save": "保存",
    "Status": "状态",
    "Task details": "任务详情",
    "Title": "标题",
    "Todo": "待办",
    
    # auto.components.tasks.TaskList
    "Add task": "添加任务",
    "All tasks": "所有任务",
    "Completed": "已完成",
    "Filter tasks...": "筛选任务...",
    "In progress": "进行中",
    "No tasks found": "未找到任务",
    "Todo": "待办",
    
    # auto.components.terminal.TerminalContextMenu
    "Clear": "清除",
    "Close terminal": "关闭终端",
    "Copy": "复制",
    "New terminal": "新建终端",
    "Paste": "粘贴",
    "Select all": "全选",
    "Split terminal": "拆分终端",
    
    # auto.components.terminal.TerminalPanel
    "{{count}} terminals": "{{count}} 个终端",
    "1 terminal": "1 个终端",
    "Close all terminals": "关闭所有终端",
    "Kill terminal": "终止终端",
    "New terminal": "新建终端",
    "No terminals": "无终端",
    "Split terminal": "拆分终端",
    
    # auto.components.toasts.ToastContainer
    "Dismiss": "关闭",
    
    # auto.components.workbench.Workbench
    "No workspace open": "未打开工作区",
    
    # auto.components.workspace.WorkspaceActivityBar
    "{{count}} notifications": "{{count}} 条通知",
    "1 notification": "1 条通知",
    "Activity": "活动",
    "Automations": "自动化",
    "Collapse sidebar": "折叠侧边栏",
    "Expand sidebar": "展开侧边栏",
    "Git": "Git",
    "No notifications": "无通知",
    "Orchestration": "编排",
    "Ports": "端口",
    "Skills": "技能",
    "Source Control": "源代码控制",
    "Tasks": "任务",
    
    # auto.components.workspace.WorkspaceEditorArea
    "Drag files here": "将文件拖放到此处",
    "No file open": "未打开文件",
    "Open a file from the explorer": "从资源管理器打开文件",
    
    # auto.components.workspace.WorkspaceStatusBar
    "{{count}} errors": "{{count}} 个错误",
    "{{count}} warnings": "{{count}} 个警告",
    "1 error": "1 个错误",
    "1 warning": "1 个警告",
    "Go to line": "跳转到行",
    "Ln {{line}}, Col {{column}}": "第 {{line}} 行，第 {{column}} 列",
    "No errors": "无错误",
    "No warnings": "无警告",
    "UTF-8": "UTF-8",
    
    # auto.components.workspace.WorkspaceTabBar
    "Close all": "全部关闭",
    "Close others": "关闭其他",
    "Close saved": "关闭已保存",
    "Close tab": "关闭标签页",
    "Open tabs": "打开的标签页",
    
    # auto.components.workspaceSwitcher.WorkspaceSwitcher
    "Add project": "添加项目",
    "Create workspace": "创建工作区",
    "Recent workspaces": "最近工作区",
    "Search workspaces...": "搜索工作区...",
    "Switch workspace": "切换工作区",
}
