'use strict';

const prefix = 'window.CLINIC_DATA = ';
const contactLabels = {
  phone: 'Основной телефон',
  phone2: 'Дополнительный телефон',
  address: 'Адрес клиники',
  hours: 'Часы работы',
  dayoff: 'Выходные',
};
const editor = document.getElementById('editor');
const contacts = document.getElementById('contacts');
const prices = document.getElementById('prices');
const announcements = document.getElementById('announcements');
const saveStatus = document.getElementById('save-status');

function create(tag, text) {
  const item = document.createElement(tag);
  if (text) item.textContent = text;
  return item;
}

function field(container, labelText, key, value = '', options = {}) {
  const label = create('label', labelText);
  const input = create(options.multiline ? 'textarea' : 'input');
  input.dataset.key = key;
  if (!options.multiline) input.type = options.type || 'text';
  if (options.type === 'checkbox') {
    input.checked = value;
    label.prepend(input, ' ');
  } else {
    input.value = value;
    label.append(input);
  }
  input.required = options.required || false;
  container.append(label);
  return input;
}

function button(text, action) {
  const control = create('button', text);
  control.type = 'button';
  control.addEventListener('click', action);
  return control;
}

function removeButton(container, label, ask) {
  return button(label, () => {
    if (!ask || confirm('Удалить эту запись из новой версии файла?')) container.remove();
  });
}

function addPriceRow(container, row = {}) {
  const entry = create('div');
  entry.className = 'row';
  field(entry, 'Услуга', 'name', row.name, { required: true });
  field(entry, 'Цена', 'price', row.price);
  entry.append(removeButton(entry, 'Удалить', Boolean(row.name)));
  container.append(entry);
  return entry.querySelector('input');
}

function addAnnouncement(notice = {}) {
  const entry = create('fieldset');
  entry.dataset.id = notice.id || 'notice-' + Array.from(crypto.getRandomValues(new Uint32Array(3)), (part) => part.toString(16)).join('-');
  entry.append(create('legend', 'Объявление'));
  const title = field(entry, 'Заголовок', 'title', notice.title, { required: true });
  field(entry, 'Текст', 'text', notice.text, { multiline: true, required: true });
  field(entry, 'Начало публикации', 'start', notice.start, { type: 'datetime-local', required: true });
  field(entry, 'Окончание показа плашки', 'end', notice.end, { type: 'datetime-local' });
  field(entry, 'Показывать плашку наверху сайта', 'banner', notice.banner ?? true, { type: 'checkbox' });
  entry.append(removeButton(entry, 'Удалить объявление', Boolean(notice.title)));
  announcements.append(entry);
  return title;
}

function checkData(data) {
  if (!data || !Object.keys(contactLabels).every((key) => typeof data.contact?.[key] === 'string') ||
      !data.prices || !Array.isArray(data.announcements)) throw new Error('Неизвестный формат файла.');
  for (const group of Object.values(data.prices)) {
    if (typeof group.title !== 'string' || !Array.isArray(group.rows) ||
        !group.rows.every((row) => typeof row.name === 'string' && typeof row.price === 'string')) {
      throw new Error('Проверьте раздел с ценами.');
    }
  }
  for (const notice of data.announcements) {
    if (!/^notice-[a-z\d-]+$/.test(notice.id) || typeof notice.title !== 'string' ||
        typeof notice.text !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(notice.start) ||
        typeof notice.banner !== 'boolean' || typeof notice.end !== 'string') {
      throw new Error('Проверьте формат объявлений.');
    }
  }
}

function render(data) {
  contacts.replaceChildren();
  prices.replaceChildren();
  announcements.replaceChildren();
  for (const [key, label] of Object.entries(contactLabels)) {
    const input = field(contacts, label, key, data.contact[key], {
      required: true,
      type: key.startsWith('phone') ? 'tel' : 'text',
    });
    if (key.startsWith('phone')) {
      input.addEventListener('input', () => input.setCustomValidity(''));
    }
  }

  for (const [key, group] of Object.entries(data.prices)) {
    const details = create('details');
    details.dataset.group = key;
    details.dataset.title = group.title;
    const rows = create('div');
    group.rows.forEach((row) => addPriceRow(rows, row));
    details.append(create('summary', group.title), rows,
      button('Добавить строку', () => addPriceRow(rows).focus()));
    prices.append(details);
  }

  data.announcements.forEach(addAnnouncement);
  editor.hidden = false;
  saveStatus.textContent = '';
}

function readFields(container) {
  return Object.fromEntries([...container.querySelectorAll('[data-key]')].map((input) => [
    input.dataset.key, input.type === 'checkbox' ? input.checked : input.value.trim(),
  ]));
}

document.getElementById('import').addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const status = document.getElementById('import-status');
  try {
    const contents = (await file.text()).trim();
    if (!contents.startsWith(prefix) || !contents.endsWith(';')) {
      throw new Error('Выберите dannye.js из папки site/assets.');
    }
    const data = JSON.parse(contents.slice(prefix.length, -1));
    checkData(data);
    render(data);
    status.textContent = 'Файл загружен. Теперь можно редактировать данные.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    event.target.value = '';
  }
});

document.getElementById('add-announcement').addEventListener('click', () => addAnnouncement().focus());

editor.addEventListener('invalid', (event) => {
  const section = event.target.closest('details');
  if (section) section.open = true;
}, true);

editor.addEventListener('submit', (event) => {
  event.preventDefault();
  const contact = readFields(contacts);
  for (const key of ['phone', 'phone2']) {
    if (!/^7\d{10}$/.test(contact[key].replace(/\D/g, ''))) {
      const input = contacts.querySelector('[data-key="' + key + '"]');
      input.setCustomValidity('Введите российский номер с +7 и десятью цифрами.');
      input.reportValidity();
      return;
    }
  }

  const priceData = Object.fromEntries([...prices.querySelectorAll('details')].map((group) => [
    group.dataset.group,
    { title: group.dataset.title, rows: [...group.querySelectorAll('.row')].map(readFields) },
  ]));
  const announcementData = [...announcements.querySelectorAll('fieldset')]
    .map((entry) => ({ id: entry.dataset.id, ...readFields(entry) }));
  const invalid = announcementData.find(({ end, start }) => end && end <= start);
  if (invalid) {
    saveStatus.textContent = 'Дата окончания показа должна быть позже даты публикации: «' + invalid.title + '».';
    announcements.querySelector('[data-id="' + invalid.id + '"] [data-key="end"]').focus();
    return;
  }

  const data = { contact, prices: priceData, announcements: announcementData };
  const output = prefix + JSON.stringify(data, null, 2) + ';\n';
  const url = URL.createObjectURL(new Blob([output], { type: 'application/javascript;charset=utf-8' }));
  const download = create('a');
  download.href = url;
  download.download = 'dannye.js';
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  saveStatus.textContent = 'Файл скачан. Замените им site/assets/dannye.js. Проверьте обновление на сайте.';
});
