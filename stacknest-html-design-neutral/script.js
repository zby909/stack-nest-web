const screens = [...document.querySelectorAll('nav a[data-route]')]
const screen = document.querySelector('#screen')
const title = document.querySelector('#screen-title')
const original = document.querySelector('#original')
const live = document.querySelector('#live')

// showScreen 更新离线截图与交互稿深链接，支持书签和浏览器前后退。
function showScreen() {
  const selected =
    screens.find((link) => link.dataset.screen === location.hash.slice(1)) ?? screens[0]
  for (const link of screens) {
    if (link === selected) link.setAttribute('aria-current', 'true')
    else link.removeAttribute('aria-current')
  }
  title.textContent = selected.textContent
  screen.src = selected.href
  screen.alt = 'StackNest ' + selected.textContent + '页面'
  screen.classList.toggle('mobile', selected.dataset.screen.endsWith('-mobile'))
  original.href = selected.href
  live.href = new URL(selected.dataset.route, 'http://127.0.0.1:4176').href
}

for (const link of screens) {
  link.addEventListener('click', (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    location.hash = link.dataset.screen
  })
}
window.addEventListener('hashchange', showScreen)
showScreen()
