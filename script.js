document.addEventListener('DOMContentLoaded', () => {
    const todoList = document.getElementById('todo-list');
    const doneList = document.getElementById('done-list');
    const archivedList = document.getElementById('archived-list');
    const newTaskInput = document.querySelector('#todo-column .new-task-input');
    const addTaskButton = document.querySelector('#todo-column .add-task-button');

    const modalOverlay = document.getElementById('task-detail-modal');
    const modalTaskText = document.getElementById('modal-task-text');
    const subtasksList = document.getElementById('subtasks-list');
    const newSubtaskInput = document.getElementById('new-subtask-input');
    const addSubtaskButton = document.getElementById('add-subtask-button');
    const modalDueDate = document.getElementById('modal-due-date');
    const modalLabels = document.getElementById('modal-labels');
    const modalImportance = document.getElementById('modal-importance');
    const saveTaskDetailsButton = document.getElementById('save-task-details');
    const cancelTaskDetailsButton = document.getElementById('cancel-task-details');
    const deleteTaskFromModalButton = document.getElementById('delete-task-from-modal');

    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const currentDateElement = document.getElementById('current-date');
    const dueDateFilter = document.getElementById('due-date-filter');

    let draggedItem = null;
    let currentEditingTaskElement = null; // Stores the DOM element of the task being edited

    // Helper function to get the element after which the dragged element should be inserted
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: -Infinity }).element;
    }

    // Function to create a new task element
    function createTaskElement(taskData) {
        const taskItem = document.createElement('div');
        taskItem.classList.add('task-item');
        taskItem.textContent = taskData.text;
        taskItem.setAttribute('draggable', 'true');
        taskItem.taskData = taskData; // Store task data directly on the DOM element

        // Apply importance class
        taskItem.classList.add(`importance-${taskData.importance}`);

        const actionButtons = document.createElement('div');
        actionButtons.classList.add('action-buttons');

        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.textContent = 'x';
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            taskItem.remove();
            saveTasks();
            applyFilter(); // Re-apply filter after deletion
        });
        actionButtons.appendChild(deleteButton);

        if (!taskData.isArchived) {
            const archiveButton = document.createElement('button');
            archiveButton.classList.add('archive-button');
            archiveButton.textContent = 'アーカイブ';
            archiveButton.addEventListener('click', (e) => {
                e.stopPropagation();
                taskData.isArchived = true;
                archivedList.appendChild(taskItem);
                saveTasks();
                applyFilter(); // Re-apply filter after archiving
                // Recreate the task item to update buttons
                const newTaskElement = createTaskElement(taskData);
                taskItem.replaceWith(newTaskElement);
            });
            actionButtons.appendChild(archiveButton);
        } else {
            const restoreButton = document.createElement('button');
            restoreButton.classList.add('restore-button');
            restoreButton.textContent = '復元';
            restoreButton.addEventListener('click', (e) => {
                e.stopPropagation();
                taskData.isArchived = false;
                todoList.appendChild(taskItem); // Restore to todo list by default
                saveTasks();
                applyFilter(); // Re-apply filter after restoring
                // Recreate the task item to update buttons
                const newTaskElement = createTaskElement(taskData);
                taskItem.replaceWith(newTaskElement);
            });
            actionButtons.appendChild(restoreButton);
        }

        taskItem.appendChild(actionButtons);

        taskItem.addEventListener('dragstart', () => {
            draggedItem = taskItem;
            taskItem.classList.add('dragging');
            setTimeout(() => {
                taskItem.style.display = 'none';
            }, 0);
        });

        taskItem.addEventListener('dragend', () => {
            taskItem.classList.remove('dragging');
            setTimeout(() => {
                if (draggedItem) {
                    draggedItem.style.display = 'flex';
                }
                draggedItem = null;
                saveTasks();
                applyFilter(); // Re-apply filter after drag ends
            }, 0);
        });

        // Open modal on task item click
        taskItem.addEventListener('click', () => {
            currentEditingTaskElement = taskItem;
            openTaskDetailModal(taskItem.taskData);
        });

        // Subtask tooltip on mouseover
        taskItem.addEventListener('mouseover', (e) => {
            if (taskData.subtasks && taskData.subtasks.length > 0) {
                showSubtaskTooltip(taskItem, taskData.subtasks);
            }
        });

        taskItem.addEventListener('mouseout', () => {
            hideSubtaskTooltip();
        });

        return taskItem;
    }

    // Function to create a subtask element for the modal
    function createSubtaskElement(subtaskData) {
        const subtaskItem = document.createElement('div');
        subtaskItem.classList.add('subtask-item');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = subtaskData.completed;
        checkbox.addEventListener('change', () => {
            subtaskTextSpan.classList.toggle('completed', checkbox.checked);
        });

        const subtaskTextSpan = document.createElement('span');
        subtaskTextSpan.classList.add('subtask-text');
        subtaskTextSpan.textContent = subtaskData.text;
        if (subtaskData.completed) {
            subtaskTextSpan.classList.add('completed');
        }

        const deleteSubtaskButton = document.createElement('button');
        deleteSubtaskButton.textContent = 'x';
        deleteSubtaskButton.classList.add('delete-button');
        deleteSubtaskButton.style.marginLeft = 'auto'; // Push to the right
        deleteSubtaskButton.addEventListener('click', () => {
            subtaskItem.remove();
        });

        subtaskItem.appendChild(checkbox);
        subtaskItem.appendChild(subtaskTextSpan);
        subtaskItem.appendChild(deleteSubtaskButton);

        return subtaskItem;
    }

    // Add task button event listener
    addTaskButton.addEventListener('click', () => {
        const taskText = newTaskInput.value.trim();
        if (taskText !== '') {
            const newTaskData = {
                text: taskText,
                subtasks: [], // Subtasks are now an array of objects
                dueDate: '',
                labels: '',
                importance: 'low', // Default importance
                isArchived: false // New property for archiving
            };
            const taskElement = createTaskElement(newTaskData);
            todoList.appendChild(taskElement);
            newTaskInput.value = '';
            saveTasks();
            applyFilter(); // Re-apply filter after adding new task
        }
    });

    // Drag and Drop events for task lists (columns)
    [todoList, doneList, archivedList].forEach(list => {
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(list, e.clientY);
            const draggable = document.querySelector('.dragging');
            if (draggable) {
                if (afterElement == null) {
                    list.appendChild(draggable);
                } else {
                    list.insertBefore(draggable, afterElement);
                }
            }
        });

        list.addEventListener('drop', (e) => {
            e.preventDefault();
            // Update isArchived status based on the dropped list
            if (draggedItem) {
                draggedItem.taskData.isArchived = (list === archivedList);
            }
            saveTasks();
            applyFilter(); // Re-apply filter after dropping
        });
    });

    // Modal functions
    function openTaskDetailModal(taskData) {
        modalTaskText.value = taskData.text;
        modalDueDate.value = taskData.dueDate;
        modalLabels.value = taskData.labels;
        modalImportance.value = taskData.importance;

        // Clear existing subtasks and render new ones
        subtasksList.innerHTML = '';
        taskData.subtasks.forEach(subtask => {
            subtasksList.appendChild(createSubtaskElement(subtask));
        });

        modalOverlay.classList.add('visible');
    }

    function closeTaskDetailModal() {
        modalOverlay.classList.remove('visible');
        currentEditingTaskElement = null;
    }

    // Add subtask button event listener
    addSubtaskButton.addEventListener('click', () => {
        const subtaskText = newSubtaskInput.value.trim();
        if (subtaskText !== '') {
            const newSubtaskData = { text: subtaskText, completed: false };
            subtasksList.appendChild(createSubtaskElement(newSubtaskData));
            newSubtaskInput.value = '';
        }
    });

    // Modal event listeners
    cancelTaskDetailsButton.addEventListener('click', closeTaskDetailModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeTaskDetailModal();
        }
    });

    saveTaskDetailsButton.addEventListener('click', () => {
        if (currentEditingTaskElement) {
            // Collect subtasks from the modal
            const updatedSubtasks = [];
            subtasksList.querySelectorAll('.subtask-item').forEach(subtaskItem => {
                const checkbox = subtaskItem.querySelector('input[type="checkbox"]');
                const textSpan = subtaskItem.querySelector('.subtask-text');
                updatedSubtasks.push({
                    text: textSpan.textContent,
                    completed: checkbox.checked
                });
            });

            const updatedTaskData = {
                text: modalTaskText.value.trim(),
                subtasks: updatedSubtasks,
                dueDate: modalDueDate.value.trim(),
                labels: modalLabels.value.trim(),
                importance: modalImportance.value,
                isArchived: currentEditingTaskElement.taskData.isArchived // Keep original archived status
            };

            // Remove old importance class and add new one
            currentEditingTaskElement.classList.remove(
                'importance-low',
                'importance-medium',
                'importance-high'
            );
            currentEditingTaskElement.classList.add(`importance-${updatedTaskData.importance}`);

            currentEditingTaskElement.taskData = updatedTaskData;
            currentEditingTaskElement.firstChild.textContent = updatedTaskData.text; // Update displayed text

            saveTasks();
            closeTaskDetailModal();
            applyFilter(); // Re-apply filter after saving task details
        }
    });

    deleteTaskFromModalButton.addEventListener('click', () => {
        if (currentEditingTaskElement) {
            currentEditingTaskElement.remove();
            saveTasks();
            closeTaskDetailModal();
            applyFilter(); // Re-apply filter after deleting from modal
        }
    });

    // Dark Mode Toggle
    darkModeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDarkMode = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDarkMode);
    });

    // Load dark mode preference
    function loadDarkModePreference() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.body.classList.add('dark-mode');
        }
    }

    // Display current date
    function displayCurrentDate() {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        currentDateElement.textContent = today.toLocaleDateString('ja-JP', options);
    }

    // Subtask Tooltip functions
    let subtaskTooltipTimeout;
    function showSubtaskTooltip(taskElement, subtasks) {
        clearTimeout(subtaskTooltipTimeout);
        hideSubtaskTooltip(); // Hide any existing tooltip

        const tooltip = document.createElement('div');
        tooltip.classList.add('subtask-tooltip');

        const ul = document.createElement('ul');
        subtasks.forEach(subtask => {
            const li = document.createElement('li');
            li.textContent = subtask.text;
            if (subtask.completed) {
                li.classList.add('completed');
            }
            ul.appendChild(li);
        });
        tooltip.appendChild(ul);

        taskElement.appendChild(tooltip);

        // Position the tooltip (optional, can be handled by CSS)
        // const rect = taskElement.getBoundingClientRect();
        // tooltip.style.left = `${rect.width / 2}px`;
        // tooltip.style.bottom = `${rect.height + 10}px`;
    }

    function hideSubtaskTooltip() {
        const existingTooltip = document.querySelector('.subtask-tooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }
    }

    // Filter tasks by due date
    function applyFilter() {
        const filterDate = dueDateFilter.value;

        [todoList, doneList, archivedList].forEach(list => {
            Array.from(list.children).forEach(taskItem => {
                const taskData = taskItem.taskData;
                if (filterDate === '' || taskData.dueDate === filterDate) {
                    taskItem.style.display = 'flex';
                } else {
                    taskItem.style.display = 'none';
                }
            });
        });
    }

    // Event listener for due date filter
    dueDateFilter.addEventListener('change', applyFilter);

    // Save tasks to localStorage
    function saveTasks() {
        const todoTasks = Array.from(todoList.children).map(taskItem => taskItem.taskData);
        const doneTasks = Array.from(doneList.children).map(taskItem => taskItem.taskData);
        const archivedTasks = Array.from(archivedList.children).map(taskItem => taskItem.taskData);

        localStorage.setItem('todoTasks', JSON.stringify(todoTasks));
        localStorage.setItem('doneTasks', JSON.stringify(doneTasks));
        localStorage.setItem('archivedTasks', JSON.stringify(archivedTasks));
    }

    // Load tasks from localStorage
    function loadTasks() {
        const todoTasks = JSON.parse(localStorage.getItem('todoTasks')) || [];
        const doneTasks = JSON.parse(localStorage.getItem('doneTasks')) || [];
        const archivedTasks = JSON.parse(localStorage.getItem('archivedTasks')) || [];

        todoTasks.forEach(taskData => {
            todoList.appendChild(createTaskElement(taskData));
        });

        doneTasks.forEach(taskData => {
            doneList.appendChild(createTaskElement(taskData));
        });

        archivedTasks.forEach(taskData => {
            archivedList.appendChild(createTaskElement(taskData));
        });
        applyFilter(); // Apply filter after loading tasks
    }

    loadDarkModePreference();
    displayCurrentDate();
    loadTasks();
});
