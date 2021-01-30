import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react'
import { render, createPortal } from 'react-dom'
import jsonURL from 'json-url'
import qrcode from 'qrcode'
import { debounce } from 'lodash'

type Verse = {
  text: string
  pause: number
}

type UtteranceInfo = {
  utterance: SpeechSynthesisUtterance
  pause: number
}

const App = () => {
  const canvas = useRef<HTMLCanvasElement>()
  const [form, setForm] = useState<HTMLFormElement>()

  const [qrURL, setQrURL] = useState<string>('')

  const [title, setTitle] = useState<string>('')
  const [verses, updateVerses] = useReducer(
    (
      verses: Verse[],
      {
        index,
        verse,
        verses: nextVerses,
      }:
        | { index: number; verse: Partial<Verse> | null; verses?: undefined }
        | { index?: undefined; verse?: undefined; verses: Verse[] }
    ) => {
      if (nextVerses) {
        return nextVerses
      }
      if (!verse) {
        return [...verses.splice(0, index), ...verses.splice(index + 1)]
      }
      return [
        ...verses.slice(0, index),
        { ...(verses[index] ?? ({} as Verse)), ...verse },
        ...verses.slice(index + 1),
      ]
    },
    []
  )

  const [loaded, setLoaded] = useState<boolean>(false)
  useEffect(() => {
    if (verses.length && form) {
      Array.from(form.querySelectorAll('textarea')).forEach((textarea) => {
        if (textarea.clientHeight < textarea.scrollHeight) {
          textarea.style.height = `max(1.5em, ${textarea.scrollHeight}px)`
        }
      })
    }
  }, [verses, form])

  const updateQRCode = debounce(() => {
    qrcode.toCanvas(canvas.current, window.location.href, () => {
      canvas.current.toBlob((blob) => {
        if (qrURL) {
          URL.revokeObjectURL(qrURL)
        }
        setQrURL(URL.createObjectURL(blob))
      }, 'image/jpeg')
    })
  }, 500)

  useEffect(() => {
    if (loaded) {
      jsonURL('lzw')
        .compress({ verses, title })
        .then((output) => {
          window.history.replaceState({}, `Lottus: ${title}`, output)
          updateQRCode()
        })
    }
  }, [verses, loaded, title])
  useEffect(() => {
    jsonURL('lzw')
      .decompress(window.location.pathname.slice(1))
      .then(({ verses, title }) => {
        setTitle(title)
        updateVerses({ verses })
      })
      .catch(() => console.log('No verses in URL'))
      .finally(() => setLoaded(true))
  }, [])

  const [currentVerse, setCurrentVerse] = useState<number>(-1)

  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const currentTimeout = useRef<number>(-1)

  const clear = () => {
    updateVerses({ verses: [] })
  }

  const makeUtterances = (verse) => {
    const { text, pause } = verse
    const parts = text.split(',')
    return parts.map((part, index) => {
      const utterance = new SpeechSynthesisUtterance()
      utterance.text = part ? `...${part}` : ' '
      utterance.rate = 0.6
      utterance.pitch = 0.6

      return {
        utterance,
        pause: index === parts.length - 1 ? pause : 300,
      }
    })
  }

  const speak = (index, utteranceInfos = makeUtterances(verses[index])) =>
    new Promise((resolve, reject) => {
      setCurrentVerse(index)

      utteranceInfos
        .reduce(
          (last, { utterance, pause }) =>
            last.then(
              () =>
                new Promise((resolve, reject) => {
                  utterance.addEventListener('end', () => {
                    // @ts-ignore
                    currentTimeout.current = setTimeout(resolve, pause)
                  })
                  speechSynthesis.speak(utterance)
                })
            ),
          Promise.resolve()
        )
        .then(resolve)
        .finally(() => setCurrentVerse(-1))
    })

  const play = useCallback(() => {
    setIsPlaying(true)
    verses
      .reduce(
        (last, _, index) => last.then(() => speak(index)),
        Promise.resolve()
      )
      .catch(console.log)
      .finally(() => setIsPlaying(false))
  }, [verses])

  const stop = () => {
    setIsPlaying(false)
    clearTimeout(currentTimeout.current)
    speechSynthesis.cancel()
    setCurrentVerse(-1)
  }

  if (!loaded) {
    return <>Loading...</>
  }

  return (
    <form
      ref={setForm}
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '100%',
      }}
    >
      <div
        style={{
          display: 'flex',
          padding: '10px',
          fontSize: '2em',
        }}
      >
        <span
          style={{
            padding: '0 10px',
            backgroundColor: 'black',
            color: 'white',
          }}
        >
          lottus 🧘🏻‍
        </span>
        <input
          placeholder="Pick a title..."
          type="text"
          value={title}
          style={{
            fontSize: '1em',
            color: 'black',
            paddingLeft: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            border: '2px solid black',
            flex: '1',
          }}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div
        style={{
          display: 'flex',
          padding: '10px',
        }}
      >
        <button
          type="button"
          onClick={() => {
            updateVerses({
              index: verses.length,
              verse: { text: '', pause: 1000 },
            })
          }}
        >
          Add Verse
        </button>
        <button
          type="button"
          onClick={() => {
            play()
          }}
        >
          Play
        </button>
        <button type="button" onClick={() => stop()}>
          Stop
        </button>
        <button type="button" onClick={() => clear()}>
          Clear
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          maxWidth: '100%',
          flexWrap: 'wrap',
        }}
      >
        {verses.map((verse, index) => {
          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flexBasis: '100px',
                justifyContent: 'space-between',
                padding: '10px',
                margin: '10px',
                border: '2px solid black',
                borderRadius: '10px',
                backgroundColor: currentVerse === index ? 'black' : 'lightgray',
                color: currentVerse === index ? 'white' : 'black',
                opacity: currentVerse > -1 && currentVerse !== index ? 0.5 : 1,
                transition: 'all 0.5s',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <span>Text</span>
                <textarea
                  style={{ resize: 'none', boxSizing: 'content-box' }}
                  value={verse.text}
                  onChange={(e) => {
                    updateVerses({ index, verse: { text: e.target.value } })
                  }}
                />
              </label>
              <div>
                <label
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span>Pause</span>
                  <input
                    type="number"
                    value={verse.pause / 1000}
                    min={0}
                    onChange={(e) => {
                      updateVerses({
                        index,
                        verse: { pause: e.target.valueAsNumber * 1000 },
                      })
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setIsPlaying(true)
                    speak(index)
                  }}
                >
                  Test
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        'Are you sure you want to delete this verse?'
                      )
                    ) {
                      updateVerses({ index, verse: null })
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {createPortal(
        <canvas
          style={{
            position: 'absolute',
            left: -1000,
            bottom: -1000,
          }}
          width={500}
          height={500}
          ref={canvas}
        />,
        document.body
      )}
      {qrURL && (
        <div
          style={{
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '320px',
          }}
        >
          <small style={{ background: 'darkgray' }}>Sharable QR Code:</small>
          <img
            style={{
              maxWidth: '300px',
              width: '100%',
              border: '10px solid darkgray',
            }}
            alt="QR Code"
            src={qrURL}
          />
        </div>
      )}
    </form>
  )
}

render(<App />, document.getElementById('app'))
