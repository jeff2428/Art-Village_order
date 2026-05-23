/**
 * customization.js
 * 客製化選項模組
 * 職責：客製化選項按鈕渲染與狀態管理
 */

var Customization = (function() {
  'use strict';
  
  var currentItem = null;
  var selections = {};

  function open(item) {
    currentItem = item;
    selections = {};
    renderOptions(item.customizationOptions || []);
    document.getElementById('customizationModal').classList.remove('hidden');
    document.getElementById('customizationTitle').textContent = item.name;
    var noteInput = document.getElementById('itemNote');
    if (noteInput) noteInput.value = '';
    validateSelections();
  }

  function close() {
    document.getElementById('customizationModal').classList.add('hidden');
    currentItem = null;
    selections = {};
  }

  function renderOptions(options) {
    var container = document.getElementById('customizationOptions');
    container.innerHTML = '';

    options.forEach(function(opt) {
      var group = document.createElement('div');
      group.className = 'space-y-2';
      
      var label = document.createElement('label');
      label.className = 'block text-sm font-medium text-gray-700';
      label.textContent = opt.name + (opt.required ? ' *' : '');
      group.appendChild(label);

      var choicesContainer = document.createElement('div');
      choicesContainer.className = 'flex flex-wrap gap-2';

      uniqueChoices(opt.choices || []).forEach(function(choice) {
        var btn = document.createElement('button');
        btn.className = 'customization-btn px-3 py-2 border border-gray-300 rounded-lg text-sm';
        btn.textContent = choice;
        btn.dataset.optionName = opt.name;
        btn.dataset.value = choice;
        btn.onclick = function() {
          handleSelection(opt, choice, btn, choicesContainer);
        };
        choicesContainer.appendChild(btn);
      });

      group.appendChild(choicesContainer);
      container.appendChild(group);
    });

    var noteGroup = document.createElement('div');
    noteGroup.className = 'space-y-2';
    var noteLabel = document.createElement('label');
    noteLabel.className = 'block text-sm font-medium text-gray-700';
    noteLabel.textContent = '備註（選填，最多 50 字）';
    noteGroup.appendChild(noteLabel);
    var noteInput = document.createElement('textarea');
    noteInput.id = 'itemNote';
    noteInput.className = 'w-full border border-gray-300 rounded-lg px-3 py-2';
    noteInput.rows = '2';
    noteInput.maxLength = '50';
    noteInput.placeholder = '請輸入備註（最多 50 字）';
    noteGroup.appendChild(noteInput);
    container.appendChild(noteGroup);
  }

  function handleSelection(opt, choice, btn, container) {
    if (opt.type === 'single' || !opt.type) {
      container.querySelectorAll('.customization-btn').forEach(function(b) {
        b.classList.remove('bg-green-500', 'text-white', 'border-green-500');
      });
      btn.classList.add('bg-green-500', 'text-white', 'border-green-500');
      selections[opt.name] = choice;
    } else {
      if (!Array.isArray(selections[opt.name])) {
        selections[opt.name] = [];
      }

      if (btn.classList.contains('bg-green-500')) {
        btn.classList.remove('bg-green-500', 'text-white', 'border-green-500');
        selections[opt.name] = selections[opt.name].filter(function(value) {
          return value !== choice;
        });
        if (selections[opt.name].length === 0) {
          delete selections[opt.name];
        }
      } else {
        btn.classList.add('bg-green-500', 'text-white', 'border-green-500');
        selections[opt.name].push(choice);
      }
    }
    validateSelections();
  }

  function validateSelections() {
    var confirmBtn = document.getElementById('confirmCustomization');
    var requiredOptions = (currentItem.customizationOptions || []).filter(function(opt) { return opt.required; });
    var allRequiredSelected = requiredOptions.every(function(opt) { return selections[opt.name]; });
    confirmBtn.disabled = !allRequiredSelected;
  }

  function confirm() {
    if (!currentItem) return null;
    
    var customizations = [];
    for (var key in selections) {
      if (Array.isArray(selections[key])) {
        selections[key].forEach(function(value) {
          customizations.push({
            optionName: key,
            selectedValue: value
          });
        });
      } else {
        customizations.push({
          optionName: key,
          selectedValue: selections[key]
        });
      }
    }

    var noteInput = document.getElementById('itemNote');
    var note = noteInput ? noteInput.value.trim() : '';

    var result = {
      item: currentItem,
      customizations: customizations,
      note: note
    };

    close();
    return result;
  }

  function formatCustomizations(customizations) {
    return customizations.map(function(c) {
      return c.optionName + ': ' + c.selectedValue;
    }).join(' / ');
  }

  function formatNote(note) {
    return note ? '📝 ' + note : '';
  }

  function uniqueChoices(choices) {
    var seen = {};
    var result = [];
    (choices || []).forEach(function(choice) {
      var value = String(choice || '').trim();
      if (!value || seen[value]) return;
      seen[value] = true;
      result.push(value);
    });
    return result;
  }

  return {
    open: open,
    close: close,
    confirm: confirm,
    formatCustomizations: formatCustomizations,
    formatNote: formatNote
  };
})();
