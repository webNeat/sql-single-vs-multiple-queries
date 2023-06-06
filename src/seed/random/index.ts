import path from 'path'
import {readFileSync} from 'fs'

function generator(name: string) {
  const values = readFileSync(path.join(__dirname, name + '.txt'), 'utf-8')
    .trim()
    .split(`\n`)
  const size = values.length
  return () => {
    return values[Math.floor(size * Math.random())]
  }
}

export const word = generator('word')
export const last_name = generator('last_name')
export const first_name = generator('first_name')
export function text(wordsCount = 100) {
  let words = Array(wordsCount)
  for (let i = 0; i < wordsCount; i++) words[i] = word()
  return words.join(' ')
}
