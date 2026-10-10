
import './style.css'
import { supabase, getGuestSession } from './supabase.js'

const app = document.querySelector('#app')

const state = {
  player: localStorage.getItem('mm-player') || '',
  page: 'welcome',
  size: 8,
  timed: true,
  theme: 'symbols',
  cards: [],
  flipped: [],
  matched: [],
  moves: 0,
  seconds: 0,
  timer: null,
  started: false,
  games: Number(localStorage.getItem('mm-games') || 0),
  best: Number(localStorage.getItem('mm-best') || 0),
  lastSaveSucceeded: false,
  saving: false,
}

const themes = {
  symbols: ['🍎', '🚀', '🎮', '🌙', '⚡', '🎧', '🐼', '🔥', '🌊', '🍕', '🦊', '🎯', '🌵', '💎', '🛸', '🏆'],
  food: ['🍕', '🍔', '🍟', '🌮', '🍩', '🍪', '🍉', '🍓', '🍇', '🍿', '🧁', '🍦', '🥑', '🍒', '🥨', '🍫'],
  nature: ['🌲', '🌊', '🌋', '🌵', '🌻', '🍁', '🌙', '⭐', '☁️', '🌈', '🪨', '🍄', '🦋', '🐚', '🌿', '🌎'],
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char])
}

function show(page) {
  state.page = page
  render()
}

function render() {
  if (state.page === 'welcome') return welcome()
  if (state.page === 'home') return home()
  if (state.page === 'setup') return setup()
  if (state.page === 'game') return game()
  if (state.page === 'results') return results()
}

function welcome() {
  app.innerHTML = `
    <main class="welcome">
      <div class="brand-mark">M<span>M</span></div>
      <p class="eyebrow">MEMORY MATCH</p>
      <h1>Your memory.<br><span>Your challenge.</span></h1>
      <p class="muted intro">A simple game of focus, patterns, and remembering what you saw.</p>
      <form id="login-form" class="name-form">
        <label for="player-name">PLAYER NAME</label>
        <input id="player-name" maxlength="20" placeholder="Enter a display name" value="${escapeHTML(state.player)}" required autocomplete="nickname" />
        <button class="primary" type="submit">Continue <span>→</span></button>
      </form>
      <p class="tiny">Guest mode · No password needed</p>
    </main>`

  document.querySelector('#login-form').addEventListener('submit', event => {
    event.preventDefault()

    const name = document.querySelector('#player-name').value.trim()
    if (!name) return

    state.player = name.slice(0, 20)
    localStorage.setItem('mm-player', state.player)
    show('home')
  })
}

function home() {
  app.innerHTML = `
    <div class="shell">
      ${header()}
      <main>
        <p class="eyebrow">PLAYER DASHBOARD</p>
        <h1>Ready to play, <span>${escapeHTML(state.player)}</span>?</h1>
        <p class="muted">Train your memory. Beat your best.</p>

        <section class="hero">
          <div>
            <p class="eyebrow light">YOUR NEXT CHALLENGE</p>
            <h2>Think fast.<br>Remember more.</h2>
            <p>Find every matching pair with as few moves as possible.</p>
            <button class="primary light-button" id="start">Start game <span>→</span></button>
          </div>
          <div class="hero-symbol" aria-hidden="true">▦</div>
        </section>

        <section class="stats">
          <article class="stat">
            <span class="muted">GAMES PLAYED</span>
            <strong>${state.games}</strong>
            <small>Keep building your record</small>
          </article>
          <article class="stat">
            <span class="muted">BEST MOVES</span>
            <strong>${state.best || '—'}</strong>
            <small>${state.best ? 'Your personal record' : 'Play your first game'}</small>
          </article>
        </section>

        <h2 class="section-title">Explore</h2>
        <section class="tiles">
          <button class="tile" id="themes">
            <span class="tile-icon">◈</span>
            <strong>Themes</strong>
            <small>Customize your board</small>
          </button>
          <button class="tile" id="leaderboard">
            <span class="tile-icon">♜</span>
            <strong>Leaderboard</strong>
            <small>Top 10 online scores</small>
          </button>
        </section>

        <section class="notice" id="message" aria-live="polite">
          Your personal progress is saved on this device. Completed games are submitted to the online leaderboard.
        </section>
      </main>
      ${footer()}
    </div>`

  document.querySelector('#start').onclick = () => show('setup')

  document.querySelector('#themes').onclick = () => {
    state.theme =
      state.theme === 'symbols'
        ? 'food'
        : state.theme === 'food'
          ? 'nature'
          : 'symbols'

    document.querySelector('#message').textContent =
      `Theme selected: ${state.theme}. It will be used in your next game.`
  }

  document.querySelector('#leaderboard').onclick = loadLeaderboard
}

async function loadLeaderboard() {
  const message = document.querySelector('#message')
  if (!message) return

  message.textContent = 'Loading leaderboard...'

  try {
    if (!supabase) {
      throw new Error('Supabase credentials are missing. Check .env.local.')
    }

    await getGuestSession()

    const { data, error } = await supabase
      .from('game_sessions')
      .select('display_name, board_size, moves, time_seconds, accuracy')
      .eq('completed', true)
      .order('moves', { ascending: true })
      .order('time_seconds', { ascending: true })
      .limit(10)

    if (error) throw error

    if (!data || data.length === 0) {
      message.textContent =
        'No scores yet. Finish a game to claim the first spot!'
      return
    }

    message.innerHTML = `
      <strong>🏆 TOP 10 PLAYERS</strong>
      <div class="leaderboard-list">
        ${data.map((game, index) => `
          <div class="leaderboard-row">
            <strong>#${index + 1} ${escapeHTML(game.display_name)}</strong>
            <span>${game.board_size} cards · ${game.moves} moves · ${formatTime(game.time_seconds)}</span>
          </div>
        `).join('')}
      </div>
      <button class="secondary full" id="refresh-leaderboard">Refresh scores</button>
    `

    document.querySelector('#refresh-leaderboard').onclick =
      loadLeaderboard
  } catch (error) {
    console.error('Leaderboard error:', error.message)
    message.textContent =
      `Could not load leaderboard: ${error.message}`
  }
}

function header() {
  return `
    <header class="topbar">
      <button class="wordmark" id="brand-home">
        <span class="mini-mark">M</span> MEMORY MATCH
      </button>
      <button class="profile" id="profile" title="Change player">
        ${escapeHTML(state.player.slice(0, 1).toUpperCase())}
      </button>
    </header>`
}

function footer() {
  return `
    <footer>
      <span>MEMORY MATCH</span>
      <span>Built to challenge your focus.</span>
    </footer>`
}

function setup() {
  app.innerHTML = `
    <div class="shell">
      ${header()}
      <main class="narrow">
        <button class="back" id="back">← Dashboard</button>
        <p class="eyebrow">GAME SETUP</p>
        <h1>Set your challenge.</h1>
        <p class="muted">Choose your board and how you want to play.</p>

        <section class="setup-group">
          <label>BOARD SIZE</label>
          <div class="choices">
            ${[8, 16, 32].map(size => `
              <button class="choice ${state.size === size ? 'selected' : ''}" data-size="${size}">
                <strong>${size}</strong>
                <small>${size / 2} pairs</small>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="setup-group">
          <label>THEME</label>
          <div class="choices">
            ${[['symbols', 'Symbols'], ['food', 'Food'], ['nature', 'Nature']].map(([key, label]) => `
              <button class="choice ${state.theme === key ? 'selected' : ''}" data-theme="${key}">${label}</button>
            `).join('')}
          </div>
        </section>

        <section class="toggle-row">
          <div>
            <strong>Timer</strong>
            <small>Track how long you take</small>
          </div>
          <input type="checkbox" id="timed" ${state.timed ? 'checked' : ''}>
        </section>

        <button class="primary full" id="play">Play game <span>→</span></button>
      </main>
      ${footer()}
    </div>`

  document.querySelector('#back').onclick = () => show('home')

  document.querySelectorAll('[data-size]').forEach(button => {
    button.onclick = () => {
      state.size = Number(button.dataset.size)
      setup()
    }
  })

  document.querySelectorAll('[data-theme]').forEach(button => {
    button.onclick = () => {
      state.theme = button.dataset.theme
      setup()
    }
  })

  document.querySelector('#timed').onchange = event => {
    state.timed = event.target.checked
  }

  document.querySelector('#play').onclick = startGame
}

function startGame() {
  clearInterval(state.timer)

  const symbols = [...themes[state.theme]]
  const chosen = symbols.slice(0, state.size / 2)

  state.cards = [...chosen, ...chosen]
    .map((symbol, id) => ({ id, symbol, key: Math.random() }))
    .sort((a, b) => a.key - b.key)

  state.flipped = []
  state.matched = []
  state.moves = 0
  state.seconds = 0
  state.started = false
  state.saving = false

  show('game')
}

function game() {
  const columns = state.size === 32 ? 8 : 4

  app.innerHTML = `
    <div class="shell game-shell">
      ${header()}
      <main>
        <div class="game-heading">
          <div>
            <p class="eyebrow">IN PROGRESS</p>
            <h1>Find the pairs.</h1>
          </div>
          <button class="back" id="exit">Exit</button>
        </div>

        <section class="game-stats">
          <div><small>MOVES</small><strong id="moves">${state.moves}</strong></div>
          <div><small>TIME</small><strong id="time">${formatTime(state.seconds)}</strong></div>
          <div><small>FOUND</small><strong id="found">${state.matched.length / 2}/${state.size / 2}</strong></div>
        </section>

        <section class="board board-${columns}" aria-label="Memory card board">
          ${state.cards.map(card => `
            <button
              class="card ${state.matched.includes(card.id) ? 'matched' : ''} ${state.flipped.includes(card.id) || state.matched.includes(card.id) ? 'revealed' : ''}"
              data-id="${card.id}"
              aria-label="Memory card">
              ${state.flipped.includes(card.id) || state.matched.includes(card.id)
                ? card.symbol
                : '<span class="card-back">M</span>'}
            </button>
          `).join('')}
        </section>

        <div class="game-bottom">
          <span class="muted">Match all ${state.size / 2} pairs.</span>
          <button class="back" id="restart">Restart ↻</button>
        </div>
      </main>
      ${footer()}
    </div>`

  document.querySelector('#exit').onclick = () => {
    clearInterval(state.timer)
    show('home')
  }

  document.querySelector('#restart').onclick = startGame

  document.querySelectorAll('.card').forEach(card => {
    card.onclick = () => flip(Number(card.dataset.id))
  })
}

function flip(id) {
  if (
    state.saving ||
    state.flipped.includes(id) ||
    state.matched.includes(id) ||
    state.flipped.length >= 2
  ) {
    return
  }

  if (!state.started) {
    state.started = true

    if (state.timed) {
      state.timer = setInterval(() => {
        state.seconds++

        const time = document.querySelector('#time')
        if (time) time.textContent = formatTime(state.seconds)
      }, 1000)
    }
  }

  state.flipped.push(id)
  game()

  if (state.flipped.length === 2) {
    state.moves++

    const movesElement = document.querySelector('#moves')
    if (movesElement) movesElement.textContent = state.moves

    const [first, second] = state.flipped.map(cardId =>
      state.cards.find(card => card.id === cardId)
    )

    if (first.symbol === second.symbol) {
      state.matched.push(first.id, second.id)
      state.flipped = []
      game()

      if (state.matched.length === state.size) {
        finishGame()
      }
    } else {
      setTimeout(() => {
        state.flipped = []
        game()
      }, 800)
    }
  }
}

async function finishGame() {
  if (state.saving) return

  state.saving = true
  clearInterval(state.timer)

  state.games++
  localStorage.setItem('mm-games', state.games)

  if (!state.best || state.moves < state.best) {
    state.best = state.moves
    localStorage.setItem('mm-best', state.best)
  }

  const accuracy = Math.round((state.size / 2) / state.moves * 100)
  state.lastSaveSucceeded = false

  try {
    if (!supabase) {
      throw new Error('Supabase credentials are missing. Check .env.local.')
    }

    const session = await getGuestSession()

    const { error } = await supabase
      .from('game_sessions')
      .insert({
        player_id: session.user.id,
        display_name: state.player,
        board_size: state.size,
        moves: state.moves,
        time_seconds: state.seconds,
        accuracy,
        completed: true,
      })

    if (error) throw error

    state.lastSaveSucceeded = true
    console.log('Game result saved to Supabase!')
  } catch (error) {
    console.error('Could not save game result:', error.message)
  } finally {
    state.saving = false
    show('results')
  }
}

function results() {
  const accuracy = Math.round((state.size / 2) / state.moves * 100)

  const saveMessage = state.lastSaveSucceeded
    ? 'Your score was saved online. Check the leaderboard!'
    : 'Your result is saved on this device, but the online save failed. Check the browser console.'

  app.innerHTML = `
    <div class="shell">
      ${header()}
      <main class="narrow result">
        <div class="result-icon">✓</div>
        <p class="eyebrow">CHALLENGE COMPLETE</p>
        <h1>Board cleared.</h1>
        <p class="muted">Good work, ${escapeHTML(state.player)}. Here's your result.</p>

        <section class="result-stats">
          <div><small>MOVES</small><strong>${state.moves}</strong></div>
          <div><small>TIME</small><strong>${formatTime(state.seconds)}</strong></div>
          <div><small>ACCURACY</small><strong>${accuracy}%</strong></div>
        </section>

        <p class="notice">${saveMessage}</p>
        <button class="primary full" id="again">Play again <span>→</span></button>
        <button class="secondary full" id="dashboard">Back to dashboard</button>
      </main>
      ${footer()}
    </div>`

  document.querySelector('#again').onclick = () => show('setup')
  document.querySelector('#dashboard').onclick = () => show('home')
}

function formatTime(seconds) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

app.addEventListener('click', event => {
  if (event.target.closest('#brand-home')) {
    show('home')
  }

  if (event.target.closest('#profile')) {
    const next = prompt('Enter a new display name:', state.player)

    if (next?.trim()) {
      state.player = next.trim().slice(0, 20)
      localStorage.setItem('mm-player', state.player)
      render()
    }
  }
})

render()
