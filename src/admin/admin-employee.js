/**
 * admin-employee.js
 * 管理後台 - 員工權限管理模組
 */

var AdminEmployee = (function() {
  'use strict';

  var currentEmployee = null;

  function init() {
    var stored = sessionStorage.getItem('currentEmployee');
    if (stored) {
      try {
        currentEmployee = JSON.parse(stored);
        showMainContent();
      } catch (e) {
        showLoginScreen();
      }
    } else {
      showLoginScreen();
    }
  }

  function showLoginScreen() {
    var loginOverlay = document.getElementById('loginOverlay');
    if (!loginOverlay) {
      loginOverlay = document.createElement('div');
      loginOverlay.id = 'loginOverlay';
      loginOverlay.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50';
      loginOverlay.innerHTML =
        '<div class="bg-white rounded-xl p-8 shadow-2xl max-w-md w-full" role="dialog" aria-modal="true" aria-labelledby="loginTitle">' +
          '<div id="loginPanel">' +
            '<h2 id="loginTitle" class="text-2xl font-bold mb-2 text-center text-gray-900">藝素村管理後台</h2>' +
            '<p class="text-sm text-gray-500 mb-6 text-center">請輸入員工 PIN 碼登入</p>' +
            '<div class="mb-4">' +
              '<label for="loginPinCode" class="block text-sm font-medium mb-2 text-gray-700">PIN 碼</label>' +
              '<input type="password" inputmode="numeric" id="loginPinCode" maxlength="6" class="border border-gray-300 rounded-lg px-3 py-3 w-full text-center text-2xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="••••••" oninput="AdminEmployee.normalizePinInput(this)" onkeypress="if(event.key===\'Enter\') AdminEmployee.login()">' +
            '</div>' +
            '<button onclick="AdminEmployee.login()" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-lg w-full font-medium">登入</button>' +
            '<button type="button" onclick="AdminEmployee.showForgotPinForm()" class="mt-4 w-full text-sm text-blue-600 hover:text-blue-700">忘記 PIN？</button>' +
            '<p id="loginError" class="text-red-500 text-sm mt-3 hidden" role="alert"></p>' +
          '</div>' +
          '<div id="forgotPinPanel" class="hidden">' +
            '<h2 class="text-2xl font-bold mb-2 text-gray-900">忘記 PIN</h2>' +
            '<p class="text-sm text-gray-500 mb-6">請輸入員工 ID、管理員提供的重設代碼，以及新的 PIN 碼。</p>' +
            '<div class="space-y-4">' +
              '<div>' +
                '<label for="resetEmployeeId" class="block text-sm font-medium mb-1 text-gray-700">員工 ID</label>' +
                '<input type="text" id="resetEmployeeId" class="border border-gray-300 rounded-lg px-3 py-2 w-full focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" placeholder="例如：EMP-20260518-103000">' +
              '</div>' +
              '<div>' +
                '<label for="resetToken" class="block text-sm font-medium mb-1 text-gray-700">重設代碼</label>' +
                '<input type="password" id="resetToken" class="border border-gray-300 rounded-lg px-3 py-2 w-full focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" autocomplete="one-time-code">' +
              '</div>' +
              '<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">' +
                '<div>' +
                  '<label for="resetNewPin" class="block text-sm font-medium mb-1 text-gray-700">新 PIN</label>' +
                  '<input type="password" inputmode="numeric" id="resetNewPin" maxlength="6" class="border border-gray-300 rounded-lg px-3 py-2 w-full tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" oninput="AdminEmployee.normalizePinInput(this)">' +
                '</div>' +
                '<div>' +
                  '<label for="resetConfirmPin" class="block text-sm font-medium mb-1 text-gray-700">確認新 PIN</label>' +
                  '<input type="password" inputmode="numeric" id="resetConfirmPin" maxlength="6" class="border border-gray-300 rounded-lg px-3 py-2 w-full tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" oninput="AdminEmployee.normalizePinInput(this)" onkeypress="if(event.key===\'Enter\') AdminEmployee.submitPinReset()">' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<p id="pinResetError" class="hidden mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>' +
            '<div class="mt-6 flex justify-end gap-2">' +
              '<button type="button" onclick="AdminEmployee.showLoginPinForm()" class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200">取消</button>' +
              '<button type="button" onclick="AdminEmployee.submitPinReset()" class="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">重設 PIN</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      document.body.appendChild(loginOverlay);
    }
    loginOverlay.classList.remove('hidden');
    showLoginPinForm();
    document.getElementById('loginPinCode').focus();
  }

  function login() {
    var pinCode = document.getElementById('loginPinCode').value;
    
    if (!pinCode) {
      showLoginError('請輸入 PIN 碼');
      return;
    }

    AdminApi.loginEmployee({ pinCode: pinCode })
      .then(function(result) {
        currentEmployee = result.employee;
        sessionStorage.setItem('currentEmployee', JSON.stringify(currentEmployee));
        showLoginSuccess();
        setTimeout(function() {
          showMainContent();
        }, 500);
      })
      .catch(function(err) {
        showLoginError(err.message);
      });
  }

  function showLoginError(message) {
    var errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.classList.remove('text-green-500');
    errorEl.classList.add('text-red-500');
    errorEl.classList.remove('hidden');
  }

  function showLoginSuccess() {
    var errorEl = document.getElementById('loginError');
    errorEl.textContent = '登入成功';
    errorEl.classList.remove('text-red-500');
    errorEl.classList.add('text-green-500');
    errorEl.classList.remove('hidden');
  }

  function showForgotPinForm() {
    var loginPanel = document.getElementById('loginPanel');
    var forgotPanel = document.getElementById('forgotPinPanel');
    if (!loginPanel || !forgotPanel) return;

    loginPanel.classList.add('hidden');
    forgotPanel.classList.remove('hidden');
    showPinResetError('');

    var idInput = document.getElementById('resetEmployeeId');
    if (idInput) idInput.focus();
  }

  function showLoginPinForm() {
    var loginPanel = document.getElementById('loginPanel');
    var forgotPanel = document.getElementById('forgotPinPanel');
    if (!loginPanel || !forgotPanel) return;

    forgotPanel.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    showPinResetError('');

    var loginInput = document.getElementById('loginPinCode');
    if (loginInput) loginInput.focus();
  }

  function submitPinReset() {
    var employeeId = document.getElementById('resetEmployeeId').value.trim();
    var resetToken = document.getElementById('resetToken').value.trim();
    var newPin = document.getElementById('resetNewPin').value.trim();
    var confirmPin = document.getElementById('resetConfirmPin').value.trim();

    if (!employeeId) {
      showPinResetError('請輸入員工 ID');
      return;
    }
    if (!resetToken) {
      showPinResetError('請輸入重設代碼');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      showPinResetError('新 PIN 必須為 4-6 位數字');
      return;
    }
    if (newPin !== confirmPin) {
      showPinResetError('兩次輸入的新 PIN 不一致');
      return;
    }

    AdminApi.resetEmployeePin({
      employeeId: employeeId,
      resetToken: resetToken,
      pinCode: newPin
    })
      .then(function(result) {
        showLoginPinForm();
        showLoginSuccessMessage(result.message || 'PIN 已重設，請使用新 PIN 登入');
        var pinInput = document.getElementById('loginPinCode');
        if (pinInput) pinInput.value = '';
      })
      .catch(function(err) {
        showPinResetError(err.message);
      });
  }

  function showLoginSuccessMessage(message) {
    var errorEl = document.getElementById('loginError');
    errorEl.textContent = message;
    errorEl.classList.remove('text-red-500');
    errorEl.classList.add('text-green-500');
    errorEl.classList.remove('hidden');
  }

  function showPinResetError(message) {
    var errorEl = document.getElementById('pinResetError');
    if (!errorEl) return;

    errorEl.textContent = message;
    if (message) {
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  }

  function normalizePinInput(input) {
    input.value = String(input.value || '').replace(/\D/g, '').slice(0, 6);
  }

  function showChangePinForm() {
    if (!currentEmployee) {
      showLoginScreen();
      return;
    }

    var overlay = document.getElementById('changePinOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'changePinOverlay';
      overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4';
      overlay.innerHTML =
        '<div class="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="changePinTitle">' +
          '<div class="mb-5 flex items-start justify-between">' +
            '<div>' +
              '<h2 id="changePinTitle" class="text-xl font-bold text-gray-900">修改自己的 PIN</h2>' +
              '<p class="mt-1 text-sm text-gray-500">請輸入目前 PIN，並設定新的 4-6 位數 PIN。</p>' +
            '</div>' +
            '<button type="button" onclick="AdminEmployee.cancelChangePinForm()" class="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700" aria-label="關閉">✕</button>' +
          '</div>' +
          '<div class="space-y-4">' +
            '<div>' +
              '<label for="currentPin" class="mb-1 block text-sm font-medium text-gray-700">目前 PIN</label>' +
              '<input type="password" inputmode="numeric" id="currentPin" maxlength="6" class="w-full rounded-lg border border-gray-300 px-3 py-2 tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" oninput="AdminEmployee.normalizePinInput(this)">' +
            '</div>' +
            '<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">' +
              '<div>' +
                '<label for="changeNewPin" class="mb-1 block text-sm font-medium text-gray-700">新 PIN</label>' +
                '<input type="password" inputmode="numeric" id="changeNewPin" maxlength="6" class="w-full rounded-lg border border-gray-300 px-3 py-2 tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" oninput="AdminEmployee.normalizePinInput(this)">' +
              '</div>' +
              '<div>' +
                '<label for="changeConfirmPin" class="mb-1 block text-sm font-medium text-gray-700">確認新 PIN</label>' +
                '<input type="password" inputmode="numeric" id="changeConfirmPin" maxlength="6" class="w-full rounded-lg border border-gray-300 px-3 py-2 tracking-widest focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100" oninput="AdminEmployee.normalizePinInput(this)" onkeypress="if(event.key===\'Enter\') AdminEmployee.saveOwnPin()">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<p id="changePinError" class="mt-4 hidden rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></p>' +
          '<div class="mt-6 flex justify-end gap-2">' +
            '<button type="button" onclick="AdminEmployee.cancelChangePinForm()" class="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200">取消</button>' +
            '<button type="button" onclick="AdminEmployee.saveOwnPin()" class="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">儲存新 PIN</button>' +
          '</div>' +
        '</div>';
      overlay.addEventListener('click', function(event) {
        if (event.target === overlay) cancelChangePinForm();
      });
      document.body.appendChild(overlay);
    }

    overlay.classList.remove('hidden');
    clearChangePinForm();
    var currentInput = document.getElementById('currentPin');
    if (currentInput) currentInput.focus();
  }

  function saveOwnPin() {
    if (!currentEmployee) {
      showLoginScreen();
      return;
    }

    var currentPin = document.getElementById('currentPin').value.trim();
    var newPin = document.getElementById('changeNewPin').value.trim();
    var confirmPin = document.getElementById('changeConfirmPin').value.trim();

    if (!/^\d{4,6}$/.test(currentPin)) {
      showChangePinError('請輸入目前 4-6 位數 PIN');
      return;
    }
    if (!/^\d{4,6}$/.test(newPin)) {
      showChangePinError('新 PIN 必須為 4-6 位數字');
      return;
    }
    if (newPin !== confirmPin) {
      showChangePinError('兩次輸入的新 PIN 不一致');
      return;
    }
    if (newPin === currentPin) {
      showChangePinError('新 PIN 不可與目前 PIN 相同');
      return;
    }

    AdminApi.changeEmployeePin({
      employeeId: currentEmployee.employeeId,
      currentPin: currentPin,
      newPin: newPin
    })
      .then(function(result) {
        cancelChangePinForm();
        alert(result.message || 'PIN 已更新');
      })
      .catch(function(err) {
        showChangePinError(err.message);
      });
  }

  function cancelChangePinForm() {
    var overlay = document.getElementById('changePinOverlay');
    if (overlay) overlay.classList.add('hidden');
  }

  function clearChangePinForm() {
    var fields = ['currentPin', 'changeNewPin', 'changeConfirmPin'];
    for (var i = 0; i < fields.length; i++) {
      var field = document.getElementById(fields[i]);
      if (field) field.value = '';
    }
    showChangePinError('');
  }

  function showChangePinError(message) {
    var errorEl = document.getElementById('changePinError');
    if (!errorEl) return;

    errorEl.textContent = message;
    if (message) {
      errorEl.classList.remove('hidden');
    } else {
      errorEl.classList.add('hidden');
    }
  }

  function showMainContent() {
    var loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
      loginOverlay.classList.add('hidden');
    }
    
    updateNavByRole();
  }

  function updateNavByRole() {
    if (!currentEmployee) return;
    
    var role = parseInt(currentEmployee.role);
    
    var navItems = document.querySelectorAll('aside nav a');
    for (var i = 0; i < navItems.length; i++) {
      var onclick = navItems[i].getAttribute('onclick');
      if (!onclick) continue;
      
      var section = onclick.match(/showSection\('(\w+)'\)/);
      if (!section) continue;
      
      var sectionName = section[1];
      var requiredRole = getSectionRequiredRole(sectionName);
      
      if (role > requiredRole) {
        navItems[i].classList.add('hidden');
      }
    }
    
    var employeeInfo = document.getElementById('employeeInfo');
    if (!employeeInfo) {
      employeeInfo = document.createElement('div');
      employeeInfo.id = 'employeeInfo';
      employeeInfo.className = 'px-4 py-2 border-t border-gray-700';
      document.querySelector('aside nav').appendChild(employeeInfo);
    }
    
    var roleNames = { 1: '管理員', 2: '經理', 3: '員工' };
    employeeInfo.innerHTML = 
      '<p class="text-sm text-gray-300">' + escapeHtml(currentEmployee.name) + '</p>' +
      '<p class="text-xs text-gray-400">' + (roleNames[currentEmployee.role] || '員工') + '</p>' +
      '<button onclick="AdminEmployee.showChangePinForm()" class="text-xs text-blue-300 hover:text-blue-200 mt-2 block">修改 PIN</button>' +
      '<button onclick="AdminEmployee.logout()" class="text-xs text-red-400 hover:text-red-300 mt-1">登出</button>';
  }

  function getSectionRequiredRole(sectionName) {
    var roles = {
      'menu': 2,
      'schedule': 2,
      'announcement': 2,
      'orders': 3,
      'discount': 2,
      'employee': 1
    };
    return roles[sectionName] || 3;
  }

  function logout() {
    currentEmployee = null;
    sessionStorage.removeItem('currentEmployee');
    showLoginScreen();
  }

  function loadEmployees() {
    AdminApi.getEmployees()
      .then(function(result) {
        renderEmployees(result.data || []);
      })
      .catch(function(err) {
        alert('載入員工失敗: ' + err.message);
      });
  }

  function renderEmployees(employees) {
    var container = document.getElementById('employeeList');
    container.innerHTML = '';

    if (employees.length === 0) {
      container.innerHTML = '<p class="text-gray-500">尚無員工資料</p>';
      return;
    }

    var roleNames = { 1: '管理員', 2: '經理', 3: '員工' };

    employees.forEach(function(emp, index) {
      var card = document.createElement('div');
      card.className = 'bg-white rounded-lg p-4 shadow';

      card.innerHTML =
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<p class="font-bold">' + escapeHtml(emp.name) + '</p>' +
            '<p class="text-sm text-gray-500">ID: ' + escapeHtml(emp.employeeId) + '</p>' +
            '<p class="text-sm">角色: ' + (roleNames[emp.role] || '員工') + '</p>' +
            '<p class="text-sm">最後登入: ' + escapeHtml(emp.lastLogin || '從未') + '</p>' +
          '</div>' +
          '<div class="text-right">' +
            '<span class="px-2 py-1 rounded text-sm ' + (emp.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') + '">' + (emp.enabled ? '啟用' : '停用') + '</span>' +
            '<div class="mt-2">' +
              '<button onclick="AdminEmployee.editEmployee(' + index + ')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">編輯</button>' +
              '<button onclick="AdminEmployee.toggleEmployee(' + index + ')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm">' + (emp.enabled ? '停用' : '啟用') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.appendChild(card);
    });
  }

  function showAddEmployeeForm() {
    var container = document.getElementById('employeeFormContainer');
    container.innerHTML =
      '<div class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4" role="dialog" aria-modal="true" aria-labelledby="employeeFormTitle">' +
      '<div class="w-full max-w-lg bg-white rounded-lg p-6 shadow-lg">' +
        '<div class="flex items-center justify-between mb-4">' +
          '<h3 id="employeeFormTitle" class="text-lg font-bold">新增員工</h3>' +
          '<button type="button" onclick="AdminEmployee.cancelEmployeeForm()" class="text-gray-500 hover:text-gray-700" aria-label="關閉">✕</button>' +
        '</div>' +
        '<p id="employeeFormError" class="hidden mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></p>' +
        '<div class="space-y-4">' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">員工姓名</label>' +
            '<input type="text" id="employeeName" class="border rounded px-3 py-2 w-full">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">PIN 碼（4-6 位數字）</label>' +
            '<input type="password" id="employeePinCode" maxlength="6" class="border rounded px-3 py-2 w-full">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">角色</label>' +
            '<select id="employeeRole" class="border rounded px-3 py-2 w-full">' +
              '<option value="1">管理員（所有功能）</option>' +
              '<option value="2">經理（菜單、訂單、公告）</option>' +
              '<option value="3" selected>員工（訂單）</option>' +
            '</select>' +
          '</div>' +
          '<div class="flex gap-2">' +
            '<button onclick="AdminEmployee.saveNewEmployee()" class="bg-green-500 text-white px-4 py-2 rounded">儲存</button>' +
            '<button onclick="AdminEmployee.cancelEmployeeForm()" class="bg-gray-500 text-white px-4 py-2 rounded">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    var nameInput = document.getElementById('employeeName');
    if (nameInput) nameInput.focus();
  }

  function saveNewEmployee() {
    var data = {
      name: document.getElementById('employeeName').value,
      pinCode: document.getElementById('employeePinCode').value,
      role: parseInt(document.getElementById('employeeRole').value),
      enabled: true
    };

    if (!data.name) {
      showEmployeeFormError('請輸入員工姓名');
      return;
    }

    if (!data.pinCode || data.pinCode.length < 4) {
      showEmployeeFormError('PIN 碼必須為 4-6 位數字');
      return;
    }

    AdminApi.addEmployee(data)
      .then(function(result) {
        alert(result.message);
        cancelEmployeeForm();
        loadEmployees();
      })
      .catch(function(err) {
        showEmployeeFormError('新增失敗: ' + err.message);
      });
  }

  function editEmployee(index) {
    var employees = [];
    AdminApi.getEmployees()
      .then(function(result) {
        employees = result.data || [];
        var emp = employees[index];
        var container = document.getElementById('employeeFormContainer');

        container.innerHTML =
          '<div class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4" role="dialog" aria-modal="true" aria-labelledby="employeeFormTitle">' +
          '<div class="w-full max-w-lg bg-white rounded-lg p-6 shadow-lg">' +
            '<div class="flex items-center justify-between mb-4">' +
              '<h3 id="employeeFormTitle" class="text-lg font-bold">編輯員工</h3>' +
              '<button type="button" onclick="AdminEmployee.cancelEmployeeForm()" class="text-gray-500 hover:text-gray-700" aria-label="關閉">✕</button>' +
            '</div>' +
            '<p id="employeeFormError" class="hidden mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></p>' +
            '<div class="space-y-4">' +
              '<input type="hidden" id="editEmployeeId" value="' + escapeAttribute(emp.employeeId) + '">' +
              '<div>' +
                '<label class="block text-sm font-medium mb-1">員工姓名</label>' +
                '<input type="text" id="editEmployeeName" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(emp.name) + '">' +
              '</div>' +
              '<div>' +
                '<label class="block text-sm font-medium mb-1">新 PIN 碼（選填）</label>' +
                '<input type="password" id="editEmployeePinCode" maxlength="6" class="border rounded px-3 py-2 w-full" placeholder="留空則不變更">' +
              '</div>' +
              '<div>' +
                '<label class="block text-sm font-medium mb-1">角色</label>' +
                '<select id="editEmployeeRole" class="border rounded px-3 py-2 w-full">' +
                  '<option value="1"' + (emp.role === 1 ? ' selected' : '') + '>管理員</option>' +
                  '<option value="2"' + (emp.role === 2 ? ' selected' : '') + '>經理</option>' +
                  '<option value="3"' + (emp.role === 3 ? ' selected' : '') + '>員工</option>' +
                '</select>' +
              '</div>' +
              '<div class="flex gap-2">' +
                '<button onclick="AdminEmployee.saveEditEmployee()" class="bg-green-500 text-white px-4 py-2 rounded">儲存</button>' +
                '<button onclick="AdminEmployee.cancelEmployeeForm()" class="bg-gray-500 text-white px-4 py-2 rounded">取消</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '</div>';
        var nameInput = document.getElementById('editEmployeeName');
        if (nameInput) nameInput.focus();
      });
  }

  function saveEditEmployee() {
    var data = {
      employeeId: document.getElementById('editEmployeeId').value,
      name: document.getElementById('editEmployeeName').value,
      role: parseInt(document.getElementById('editEmployeeRole').value)
    };

    var newPin = document.getElementById('editEmployeePinCode').value;
    if (newPin) {
      if (newPin.length < 4) {
        showEmployeeFormError('PIN 碼必須為 4-6 位數字');
        return;
      }
      data.pinCode = newPin;
    }

    AdminApi.updateEmployee(data)
      .then(function(result) {
        alert(result.message);
        cancelEmployeeForm();
        loadEmployees();
      })
      .catch(function(err) {
        showEmployeeFormError('更新失敗: ' + err.message);
      });
  }

  function toggleEmployee(index) {
    AdminApi.getEmployees()
      .then(function(result) {
        var employees = result.data || [];
        var emp = employees[index];

        AdminApi.updateEmployee({
          employeeId: emp.employeeId,
          enabled: !emp.enabled
        })
          .then(function(result) {
            alert(result.message);
            loadEmployees();
          })
          .catch(function(err) {
            alert('操作失敗: ' + err.message);
          });
      });
  }

  function cancelEmployeeForm() {
    document.getElementById('employeeFormContainer').innerHTML = '';
  }

  function showEmployeeFormError(message) {
    var errorEl = document.getElementById('employeeFormError');
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function loadAuditLog() {
    AdminApi.getAuditLog({ limit: 100 })
      .then(function(result) {
        renderAuditLog(result.data || []);
      })
      .catch(function(err) {
        alert('載入日誌失敗: ' + err.message);
      });
  }

  function renderAuditLog(logs) {
    var container = document.getElementById('auditLogList');
    container.innerHTML = '';

    if (logs.length === 0) {
      container.innerHTML = '<p class="text-gray-500">尚無操作紀錄</p>';
      return;
    }

    logs.forEach(function(log) {
      var row = document.createElement('div');
      row.className = 'bg-white rounded-lg p-4 shadow';

      row.innerHTML =
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<p class="font-bold text-sm">' + escapeHtml(log.timestamp) + '</p>' +
            '<p class="text-sm">員工: ' + escapeHtml(log.employeeId) + '</p>' +
            '<p class="text-sm mt-1">動作: ' + escapeHtml(log.action) + '</p>' +
            (log.target ? '<p class="text-sm">目標: ' + escapeHtml(log.target) + '</p>' : '') +
          '</div>' +
          '<div class="text-right">' +
            '<p class="text-xs text-gray-400">' + escapeHtml(log.logId) + '</p>' +
          '</div>' +
        '</div>';

      container.appendChild(row);
    });
  }

  return {
    init: init,
    login: login,
    logout: logout,
    showForgotPinForm: showForgotPinForm,
    showLoginPinForm: showLoginPinForm,
    submitPinReset: submitPinReset,
    normalizePinInput: normalizePinInput,
    showChangePinForm: showChangePinForm,
    saveOwnPin: saveOwnPin,
    cancelChangePinForm: cancelChangePinForm,
    loadEmployees: loadEmployees,
    showAddEmployeeForm: showAddEmployeeForm,
    saveNewEmployee: saveNewEmployee,
    editEmployee: editEmployee,
    saveEditEmployee: saveEditEmployee,
    toggleEmployee: toggleEmployee,
    cancelEmployeeForm: cancelEmployeeForm,
    loadAuditLog: loadAuditLog
  };
})();
