/**
 * TexClinic – app.js
 * Sistema de Cadastro de Pacientes
 *
 * Módulos:
 *  1. StorageService   – CRUD no LocalStorage
 *  2. ViaCEPService    – Consulta de endereço via ViaCEP
 *  3. MaskService      – Máscaras de input (CPF, telefone, CEP)
 *  4. ValidatorService – Validação de campos do formulário
 *  5. ToastService     – Notificações visuais (toast)
 *  6. ModalService     – Diálogo de confirmação
 *  7. TableService     – Renderização e ordenação da tabela
 *  8. FormController   – Controle do formulário (create / edit)
 *  9. SearchController – Busca em tempo real
 * 10. SidebarController– Controle da sidebar (mobile)
 * 11. App              – Inicialização e orquestração geral
 */

'use strict';

/* ============================================================
   1. STORAGE SERVICE
   ============================================================ */
const StorageService = (() => {
  const KEY = 'texclinic_patients';

  /** Retorna todos os pacientes */
  const getAll = () => {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || [];
    } catch {
      return [];
    }
  };

  /** Salva a lista completa */
  const _save = (list) => {
    localStorage.setItem(KEY, JSON.stringify(list));
  };

  /** Adiciona um paciente e retorna o objeto com id */
  const add = (patient) => {
    const list = getAll();
    const newPatient = { ...patient, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    list.push(newPatient);
    _save(list);
    return newPatient;
  };

  /** Atualiza um paciente pelo id */
  const update = (id, data) => {
    const list = getAll();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...data, updatedAt: new Date().toISOString() };
    _save(list);
    return list[idx];
  };

  /** Remove um paciente pelo id */
  const remove = (id) => {
    const list = getAll().filter(p => p.id !== id);
    _save(list);
  };

  /** Busca um paciente pelo id */
  const findById = (id) => getAll().find(p => p.id === id) || null;

  return { getAll, add, update, remove, findById };
})();


/* ============================================================
   2. VIACEP SERVICE
   ============================================================ */
const ViaCEPService = (() => {
  /**
   * Busca endereço pelo CEP informado.
   * @param {string} cep - CEP sem máscara (8 dígitos)
   * @returns {Promise<Object>} Dados do endereço ou lança Error
   */
  const fetchAddress = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) throw new Error('CEP inválido');

    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error('Falha na requisição à API ViaCEP');

    const data = await response.json();
    if (data.erro) throw new Error('CEP não encontrado');

    return data;
  };

  return { fetchAddress };
})();


/* ============================================================
   3. MASK SERVICE
   ============================================================ */
const MaskService = (() => {
  /** Aplica máscara de CPF: 000.000.000-00 */
  const cpf = (value) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  /** Aplica máscara de telefone: (00) 00000-0000 */
  const phone = (value) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
  };

  /** Aplica máscara de CEP: 00000-000 */
  const cep = (value) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 8)
      .replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  };

  return { cpf, phone, cep };
})();


/* ============================================================
   4. VALIDATOR SERVICE
   ============================================================ */
const ValidatorService = (() => {
  const rules = {
    name: {
      validate: (v) => v.trim().length >= 3,
      message: 'Informe o nome completo (mínimo 3 caracteres).',
    },
    cpf: {
      validate: (v) => _isValidCPF(v),
      message: 'CPF inválido. Verifique o número informado.',
    },
    birthdate: {
      validate: (v) => {
        if (!v) return false;
        const d = new Date(v + 'T00:00:00');
        return !isNaN(d) && d < new Date() && d.getFullYear() > 1900;
      },
      message: 'Informe uma data de nascimento válida.',
    },
    phone: {
      validate: (v) => v.replace(/\D/g, '').length >= 10,
      message: 'Informe um telefone válido com DDD.',
    },
    cep: {
      validate: (v) => v.replace(/\D/g, '').length === 8,
      message: 'CEP inválido. Deve conter 8 dígitos.',
    },
    street: {
      validate: (v) => v.trim().length >= 3,
      message: 'Informe o logradouro.',
    },
  };

  /**
   * Valida o formulário inteiro.
   * @param {Object} data - Dados do formulário { name, cpf, ... }
   * @returns {{ valid: boolean, errors: Object }}
   */
  const validateForm = (data) => {
    const errors = {};
    for (const [field, rule] of Object.entries(rules)) {
      if (!rule.validate(data[field] || '')) {
        errors[field] = rule.message;
      }
    }
    return { valid: Object.keys(errors).length === 0, errors };
  };

  /** Algoritmo de validação de CPF */
  function _isValidCPF(cpfStr) {
    const cpf = cpfStr.replace(/\D/g, '');
    if (cpf.length !== 11) return false;
    if (/^(\d)\1+$/.test(cpf)) return false; // todos dígitos iguais

    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    if (rem !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    rem = (sum * 10) % 11;
    if (rem === 10 || rem === 11) rem = 0;
    return rem === parseInt(cpf[10]);
  }

  return { validateForm };
})();


/* ============================================================
   5. TOAST SERVICE
   ============================================================ */
const ToastService = (() => {
  const container = document.getElementById('toast-container');

  const ICONS = {
    success: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>`,
    error: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`,
    info: `<svg class="toast__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`,
  };

  /**
   * Exibe um toast.
   * @param {string} message
   * @param {'success'|'error'|'info'} type
   * @param {number} duration - ms
   */
  const show = (message, type = 'info', duration = 4000) => {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      ${ICONS[type] || ICONS.info}
      <span class="toast__text">${message}</span>
      <button class="toast__close" aria-label="Fechar notificação">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m18 6-12 12"/><path d="m6 6 12 12"/></svg>
      </button>
    `;

    container.appendChild(toast);

    const dismiss = () => {
      toast.classList.add('hiding');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    toast.querySelector('.toast__close').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  };

  return { show };
})();


/* ============================================================
   6. MODAL SERVICE
   ============================================================ */
const ModalService = (() => {
  const overlay = document.getElementById('modal-overlay');
  const patientSpan = document.getElementById('modal-patient-name');
  const btnCancel = document.getElementById('modal-cancel');
  const btnConfirm = document.getElementById('modal-confirm');

  let _resolvePromise = null;

  const _close = () => {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (_resolvePromise) { _resolvePromise(false); _resolvePromise = null; }
  };

  /**
   * Abre o modal de confirmação de exclusão.
   * @param {string} name - Nome do paciente
   * @returns {Promise<boolean>}
   */
  const confirmDelete = (name) => {
    patientSpan.textContent = name;
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    btnConfirm.focus();

    return new Promise((resolve) => {
      _resolvePromise = resolve;
    });
  };

  btnCancel.addEventListener('click', _close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) _close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !overlay.hidden) _close(); });

  btnConfirm.addEventListener('click', () => {
    overlay.hidden = true;
    document.body.style.overflow = '';
    if (_resolvePromise) { _resolvePromise(true); _resolvePromise = null; }
  });

  return { confirmDelete };
})();


/* ============================================================
   7. TABLE SERVICE
   ============================================================ */
const TableService = (() => {
  const tbody = document.getElementById('patient-table-body');
  const emptyState = document.getElementById('empty-state');
  const emptyTitle = document.getElementById('empty-state-title');
  const emptySubtitle = document.getElementById('empty-state-subtitle');
  const badgeTotal = document.getElementById('badge-total');
  const sidebarBadge = document.getElementById('patient-count-badge');

  let _sortField = 'name';
  let _sortAsc = true;
  let _onEdit, _onDelete;

  /** Formata data ISO para DD/MM/AAAA */
  const _formatDate = (iso) => {
    if (!iso) return '–';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  };

  /** Retorna as iniciais do nome */
  const _initials = (name) => {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  };

  /** Monta linha da tabela */
  const _buildRow = (patient) => {
    const address = [patient.street, patient.number, patient.neighborhood, patient.city, patient.uf]
      .filter(Boolean).join(', ') || '–';

    const tr = document.createElement('tr');
    tr.dataset.id = patient.id;
    tr.innerHTML = `
      <td class="td-name">
        <div class="td-name__wrapper">
          <span class="td-name__avatar" aria-hidden="true">${_initials(patient.name)}</span>
          ${_escapeHtml(patient.name)}
        </div>
      </td>
      <td>${_escapeHtml(patient.cpf)}</td>
      <td>${_formatDate(patient.birthdate)}</td>
      <td>${_escapeHtml(patient.phone)}</td>
      <td class="td-address" title="${_escapeHtml(address)}">${_escapeHtml(address)}</td>
      <td class="td-actions">
        <div class="td-actions-inner">
          <button
            class="btn btn--icon btn--icon-edit"
            data-action="edit"
            data-id="${patient.id}"
            aria-label="Editar paciente ${_escapeHtml(patient.name)}"
            title="Editar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
          <button
            class="btn btn--icon btn--icon-delete"
            data-action="delete"
            data-id="${patient.id}"
            aria-label="Excluir paciente ${_escapeHtml(patient.name)}"
            title="Excluir"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6m5 0V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    `;
    return tr;
  };

  /** Escapa HTML para evitar XSS */
  const _escapeHtml = (str) => {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  };

  /** Renderiza a tabela com lista filtrada */
  const render = (patients, searchTerm = '') => {
    // Ordena
    const sorted = [...patients].sort((a, b) => {
      const va = (a[_sortField] || '').toLowerCase();
      const vb = (b[_sortField] || '').toLowerCase();
      return _sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

    // Filtra
    const term = searchTerm.toLowerCase().trim();
    const filtered = term
      ? sorted.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.cpf.includes(term) ||
        p.phone.includes(term)
      )
      : sorted;

    tbody.innerHTML = '';

    // Atualiza contadores
    const total = StorageService.getAll().length;
    sidebarBadge.textContent = total;
    badgeTotal.textContent = `${total} ${total === 1 ? 'paciente' : 'pacientes'}`;

    if (filtered.length === 0) {
      emptyState.hidden = false;
      if (term) {
        emptyTitle.textContent = 'Nenhum resultado encontrado';
        emptySubtitle.textContent = `Nenhum paciente encontrado para "${searchTerm}".`;
      } else {
        emptyTitle.textContent = 'Nenhum paciente cadastrado';
        emptySubtitle.textContent = 'Cadastre o primeiro paciente usando o formulário acima.';
      }
      return;
    }

    emptyState.hidden = true;
    filtered.forEach(patient => tbody.appendChild(_buildRow(patient)));
  };

  /** Configura cabeçalhos de ordenação */
  const initSortHeaders = () => {
    document.querySelectorAll('.th-sortable').forEach(th => {
      const handler = () => {
        const field = th.dataset.sort;
        if (_sortField === field) {
          _sortAsc = !_sortAsc;
        } else {
          _sortField = field;
          _sortAsc = true;
        }
        document.querySelectorAll('.th-sortable').forEach(h => h.setAttribute('aria-sort', 'none'));
        th.setAttribute('aria-sort', _sortAsc ? 'ascending' : 'descending');
        render(StorageService.getAll(), document.getElementById('search-input').value);
      };

      th.addEventListener('click', handler);
      th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handler(); } });
    });
  };

  /** Delega cliques de edição e exclusão na tabela */
  const initActions = (onEdit, onDelete) => {
    _onEdit = onEdit;
    _onDelete = onDelete;
    tbody.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;
      if (action === 'edit') _onEdit(id);
      if (action === 'delete') _onDelete(id);
    });
  };

  return { render, initSortHeaders, initActions };
})();


/* ============================================================
   8. FORM CONTROLLER
   ============================================================ */
const FormController = (() => {
  // DOM refs
  const form = document.getElementById('patient-form');
  const btnSubmit = document.getElementById('btn-submit');
  const btnSubmitLbl = document.getElementById('btn-submit-label');
  const btnCancel = document.getElementById('btn-cancel');
  const cepInput = document.getElementById('patient-cep');
  const cepSpinner = document.getElementById('cep-spinner');

  const inputs = {
    name: document.getElementById('patient-name'),
    cpf: document.getElementById('patient-cpf'),
    birthdate: document.getElementById('patient-birthdate'),
    phone: document.getElementById('patient-phone'),
    cep: document.getElementById('patient-cep'),
    street: document.getElementById('patient-street'),
    neighborhood: document.getElementById('patient-neighborhood'),
    city: document.getElementById('patient-city'),
    uf: document.getElementById('patient-uf'),
    number: document.getElementById('patient-number'),
    complement: document.getElementById('patient-complement'),
  };

  let _editingId = null;
  let _cepDebounce = null;

  /* ---- Helpers ---- */

  const _getFormData = () => ({
    name: inputs.name.value,
    cpf: inputs.cpf.value,
    birthdate: inputs.birthdate.value,
    phone: inputs.phone.value,
    cep: inputs.cep.value,
    street: inputs.street.value,
    neighborhood: inputs.neighborhood.value,
    city: inputs.city.value,
    uf: inputs.uf.value,
    number: inputs.number.value,
    complement: inputs.complement.value,
  });

  const _setError = (field, message) => {
    const groupEl = document.getElementById(`group-${field}`);
    const errorEl = document.getElementById(`error-${field}`);
    const inputEl = inputs[field];
    if (!inputEl) return;
    inputEl.classList.add('form__input--error');
    inputEl.classList.remove('form__input--success');
    if (errorEl) errorEl.textContent = message;
    if (groupEl) groupEl.setAttribute('data-invalid', 'true');
  };

  const _clearError = (field) => {
    const groupEl = document.getElementById(`group-${field}`);
    const errorEl = document.getElementById(`error-${field}`);
    const inputEl = inputs[field];
    if (!inputEl) return;
    inputEl.classList.remove('form__input--error');
    if (errorEl) errorEl.textContent = '';
    if (groupEl) groupEl.removeAttribute('data-invalid');
  };

  const _clearAllErrors = () => {
    Object.keys(inputs).forEach(_clearError);
  };

  const _setInputSuccess = (field) => {
    inputs[field]?.classList.add('form__input--success');
    inputs[field]?.classList.remove('form__input--error');
  };

  /** Preenche o formulário com dados de um paciente (modo edição) */
  const _fillForm = (patient) => {
    Object.keys(inputs).forEach(key => {
      if (inputs[key]) inputs[key].value = patient[key] || '';
    });
  };

  /** Limpa o formulário completamente */
  const reset = () => {
    _editingId = null;
    form.reset();
    _clearAllErrors();
    Object.values(inputs).forEach(el => {
      el?.classList.remove('form__input--success', 'form__input--error');
    });
    btnSubmitLbl.textContent = 'Salvar Paciente';
    btnCancel.hidden = true;
    document.querySelector('#form-title').textContent = 'Cadastrar Paciente';
    document.querySelector('#section-form .section__subtitle').textContent =
      'Preencha os dados abaixo para registrar um novo paciente no sistema.';
    inputs.name.focus();
  };

  /* ---- CEP Autocomplete ---- */

  const _handleCEP = async () => {
    const rawCep = cepInput.value.replace(/\D/g, '');
    _clearError('cep');
    inputs.cep.classList.remove('form__input--success', 'form__input--error');

    if (rawCep.length < 8) return;

    cepSpinner.hidden = false;
    cepInput.disabled = true;

    try {
      const data = await ViaCEPService.fetchAddress(rawCep);
      inputs.street.value = data.logradouro || '';
      inputs.neighborhood.value = data.bairro || '';
      inputs.city.value = data.localidade || '';
      inputs.uf.value = data.uf || '';

      _setInputSuccess('cep');
      ['street', 'neighborhood', 'city', 'uf'].forEach(_setInputSuccess);

      inputs.number.focus();
      ToastService.show('Endereço preenchido automaticamente!', 'success', 3000);
    } catch (err) {
      _setError('cep', err.message || 'Não foi possível buscar o CEP.');
      ToastService.show(err.message || 'CEP não encontrado.', 'error');
    } finally {
      cepSpinner.hidden = true;
      cepInput.disabled = false;
    }
  };

  /* ---- Masks ---- */
  inputs.cpf.addEventListener('input', () => {
    inputs.cpf.value = MaskService.cpf(inputs.cpf.value);
  });

  inputs.phone.addEventListener('input', () => {
    inputs.phone.value = MaskService.phone(inputs.phone.value);
  });

  cepInput.addEventListener('input', () => {
    cepInput.value = MaskService.cep(cepInput.value);
    clearTimeout(_cepDebounce);
    if (cepInput.value.replace(/\D/g, '').length === 8) {
      _cepDebounce = setTimeout(_handleCEP, 400);
    }
  });

  /* ---- Inline validation on blur ---- */
  ['name', 'cpf', 'birthdate', 'phone', 'cep', 'street'].forEach(field => {
    inputs[field]?.addEventListener('blur', () => {
      const data = _getFormData();
      const { errors } = ValidatorService.validateForm(data);
      if (errors[field]) {
        _setError(field, errors[field]);
      } else {
        _clearError(field);
        if (inputs[field]?.value.trim()) _setInputSuccess(field);
      }
    });
  });

  /* ---- Form Submit ---- */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    _clearAllErrors();

    const data = _getFormData();
    const { valid, errors } = ValidatorService.validateForm(data);

    if (!valid) {
      Object.entries(errors).forEach(([field, msg]) => _setError(field, msg));
      // Foca no primeiro campo com erro
      const firstField = Object.keys(errors)[0];
      inputs[firstField]?.focus();
      ToastService.show('Por favor, corrija os campos destacados.', 'error');
      return;
    }

    if (_editingId) {
      StorageService.update(_editingId, data);
      ToastService.show(`Paciente "${data.name}" atualizado com sucesso!`, 'success');
    } else {
      StorageService.add(data);
      ToastService.show(`Paciente "${data.name}" cadastrado com sucesso!`, 'success');
    }

    TableService.render(StorageService.getAll());
    reset();
    // Rola até a tabela
    document.getElementById('section-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---- Cancel Button ---- */
  btnCancel.hidden = true;
  btnCancel.addEventListener('click', reset);

  /* ---- Edit Handler (chamado pelo TableService) ---- */
  const startEdit = (id) => {
    const patient = StorageService.findById(id);
    if (!patient) return;

    _editingId = id;
    _fillForm(patient);
    _clearAllErrors();

    btnSubmitLbl.textContent = 'Atualizar Paciente';
    btnCancel.hidden = false;
    document.querySelector('#form-title').textContent = 'Editar Paciente';
    document.querySelector('#section-form .section__subtitle').textContent =
      `Editando os dados de "${patient.name}".`;

    document.getElementById('section-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    inputs.name.focus();
    ToastService.show(`Editando "${patient.name}". Faça as alterações e salve.`, 'info');
  };

  return { startEdit, reset };
})();


/* ============================================================
   9. SEARCH CONTROLLER
   ============================================================ */
const SearchController = (() => {
  const input = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  let _debounce = null;

  input.addEventListener('input', () => {
    clearTimeout(_debounce);
    clearBtn.hidden = input.value.length === 0;
    _debounce = setTimeout(() => {
      TableService.render(StorageService.getAll(), input.value);
    }, 250);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    clearBtn.hidden = true;
    TableService.render(StorageService.getAll());
    input.focus();
  });

  return {};
})();


/* ============================================================
   10. SIDEBAR CONTROLLER
   ============================================================ */
const SidebarController = (() => {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebar-toggle');
  const overlay = document.getElementById('sidebar-overlay');

  const open = () => {
    sidebar.classList.add('sidebar--open');
    overlay.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    sidebar.classList.remove('sidebar--open');
    overlay.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  toggle.addEventListener('click', () => sidebar.classList.contains('sidebar--open') ? close() : open());
  overlay.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && sidebar.classList.contains('sidebar--open')) close(); });

  // Nav links fecham sidebar no mobile
  document.querySelectorAll('.sidebar__link').forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth < 769) close();
      // Atualiza link ativo
      document.querySelectorAll('.sidebar__link').forEach(l => {
        l.classList.remove('sidebar__link--active');
        l.removeAttribute('aria-current');
      });
      link.classList.add('sidebar__link--active');
      link.setAttribute('aria-current', 'page');
    });
  });

  return {};
})();


/* ============================================================
   11. APP – INICIALIZAÇÃO
   ============================================================ */
const App = (() => {
  const init = () => {
    // Botão "ir para cadastro" no empty state
    document.getElementById('btn-goto-form')?.addEventListener('click', () => {
      document.getElementById('section-form').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('patient-name').focus();
    });

    // Inicializa cabeçalhos de ordenação
    TableService.initSortHeaders();

    // Delega edição e exclusão
    TableService.initActions(
      // Edit
      (id) => FormController.startEdit(id),
      // Delete
      async (id) => {
        const patient = StorageService.findById(id);
        if (!patient) return;

        const confirmed = await ModalService.confirmDelete(patient.name);
        if (!confirmed) return;

        // Animação de saída
        const row = document.querySelector(`[data-id="${id}"]`);
        if (row) {
          row.classList.add('deleting');
          row.addEventListener('animationend', () => {
            StorageService.remove(id);
            TableService.render(StorageService.getAll(), document.getElementById('search-input').value);
            ToastService.show(`Paciente "${patient.name}" removido.`, 'info');
          }, { once: true });
        } else {
          StorageService.remove(id);
          TableService.render(StorageService.getAll(), document.getElementById('search-input').value);
          ToastService.show(`Paciente "${patient.name}" removido.`, 'info');
        }
      }
    );

    // Renderização inicial
    TableService.render(StorageService.getAll());
  };

  document.addEventListener('DOMContentLoaded', init);
})();
