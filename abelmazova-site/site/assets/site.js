'use strict';

const clinicData = window.CLINIC_DATA;
const contact = clinicData?.contact;
const defaultBookingMessage = 'Администратор подберёт удобное время и ответит на вопросы.';

function element(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text) item.textContent = text;
  return item;
}

function telephone(value) {
  return 'tel:+' + value.replace(/\D/g, '');
}

function updateContact() {
  if (!contact) return;

  document.querySelectorAll('[data-contact]').forEach((item) => {
    const value = contact[item.dataset.contact];
    if (typeof value === 'string') item.textContent = value;
  });
  document.querySelectorAll('[data-phone]').forEach((link) => {
    const value = contact[link.dataset.phone];
    if (value) link.href = telephone(value);
  });
}

function updatePrices() {
  document.querySelectorAll('[data-price]').forEach((block) => {
    const group = clinicData?.prices?.[block.dataset.price];
    if (!Array.isArray(group?.rows)) return;

    if (!group.rows.length) {
      const message = element('p', 'price-empty', 'Стоимость уточняйте в ');
      const link = element('a', '', 'регистратуре');
      link.href = telephone(contact.phone);
      message.append(link, '.');
      block.replaceChildren(message);
      return;
    }

    const rows = group.rows.map(({ name, price }) => {
      const row = element('div', 'price-row');
      row.append(
        element('span', 'price-row__name', name),
        element('span', 'price-row__dots'),
        element('span', 'price-row__val', price || 'уточняйте'),
      );
      return row;
    });
    block.replaceChildren(...rows);
  });
}

function announcementTime(datetime) {
  return Date.parse(datetime + '+03:00');
}

function displayDate(datetime) {
  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'long',
    timeZone: 'Europe/Moscow',
  }).format(announcementTime(datetime));
}

function showAnnouncements() {
  const now = Date.now();
  const releases = (clinicData?.announcements || [])
    .filter(({ start }) => announcementTime(start) <= now)
    .sort((a, b) => announcementTime(b.start) - announcementTime(a.start));

  const news = document.querySelector('[data-announcements]');
  if (news && releases.length) {
    const entries = releases.map(({ id, title, text, start }) => {
      const article = element('article', 'card news-item');
      article.id = id;
      const date = element('time', '', displayDate(start));
      date.dateTime = start + '+03:00';
      article.append(date, element('h2', '', title), element('p', '', text));
      return article;
    });
    news.replaceChildren(...entries);
  }

  const notice = document.querySelector('[data-site-notice]');
  const active = releases.find(({ banner, end }) => banner && (!end || announcementTime(end) > now));
  if (notice && active) {
    const content = element('div', 'container');
    const link = element('a', '', active.title);
    link.href = notice.dataset.newsUrl + '#' + active.id;
    content.append(link);
    notice.replaceChildren(content);
    notice.hidden = false;
  }
}

function wireMenu() {
  const toggle = document.querySelector('[data-burger]');
  const navigation = document.getElementById('primary-nav');

  function setOpen(open) {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') === 'false'));
  navigation.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia('(max-width: 1024px)').addEventListener('change', () => setOpen(false));
}

function wireBooking() {
  const dialog = document.getElementById('booking');
  if (typeof dialog.showModal !== 'function') return;

  const message = dialog.querySelector('[data-booking-message]');
  document.querySelectorAll('[data-book]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const doctor = link.dataset.doctor;
      message.textContent = doctor
        ? 'Чтобы записаться к ' + doctor + ', позвоните в регистратуру.'
        : defaultBookingMessage;
      dialog.showModal();
      document.body.classList.add('dialog-open');
    });
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
}

function wireGallery() {
  const links = [...document.querySelectorAll('[data-lb]')];
  if (!links.length) return;

  const dialog = element('dialog', 'photo-dialog');
  if (typeof dialog.showModal !== 'function') return;
  dialog.setAttribute('aria-label', 'Фотографии центра');
  const photo = element('img');
  const controls = [
    ['lightbox__close', 'Закрыть', '×', () => dialog.close()],
    ['lightbox__nav prev', 'Предыдущее фото', '‹', () => show(index - 1)],
    ['lightbox__nav next', 'Следующее фото', '›', () => show(index + 1)],
  ];
  let index = 0;

  function show(position) {
    index = (position + links.length) % links.length;
    photo.src = links[index].href;
    photo.alt = links[index].querySelector('img').alt;
  }

  dialog.append(photo);
  for (const [style, label, text, action] of controls) {
    const button = element('button', style, text);
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.addEventListener('click', action);
    dialog.append(button);
  }
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') show(index - 1);
    if (event.key === 'ArrowRight') show(index + 1);
  });
  dialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
  document.body.append(dialog);

  links.forEach((link, position) => {
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      show(position);
      dialog.showModal();
      document.body.classList.add('dialog-open');
    });
  });
}

function animateSections() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    }
  }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });

  document.querySelectorAll('.reveal').forEach((item) => {
    if (item.getBoundingClientRect().top < innerHeight) item.classList.add('in');
    else observer.observe(item);
  });
  document.body.classList.add('motion');
}

function supportLocalFiles() {
  if (location.protocol !== 'file:') return;

  document.querySelectorAll('a[href]').forEach((link) => {
    const relative = link.getAttribute('href');
    if (!relative.startsWith('./') && !relative.startsWith('../')) return;
    const url = new URL(link.href);
    if (!url.pathname.endsWith('/')) return;
    url.pathname += 'index.html';
    link.href = url.href;
  });
}

document.querySelectorAll('[data-ic]').forEach((item) => {
  const icon = item.dataset.ic;
  const svg = (path) => '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + path + '</svg>';
  item.innerHTML = icon === 'stars5' ? svg(ICONS.star).repeat(5) : svg(ICONS[icon] || '');
});
document.querySelector('[data-year]').textContent = new Date().getFullYear();

updateContact();
updatePrices();
showAnnouncements();
supportLocalFiles();
wireMenu();
wireBooking();
wireGallery();
document.body.classList.add('enhanced');
animateSections();

if (location.hash.startsWith('#notice-')) {
  document.getElementById(location.hash.slice(1))?.scrollIntoView();
}
