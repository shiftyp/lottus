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
import debounce from 'lodash/debounce'
import { updateWith } from 'lodash'

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
          window.history.replaceState({}, '', output)
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

  const isPlaying = useRef<boolean>(false)
  const currentTimeout = useRef<number>(-1)

  const clear = () => {
    updateVerses({ verses: [] })
  }

  const makeUtterance = (verse) => {
    const { text, pause } = verse
    const utterance = new SpeechSynthesisUtterance()
    utterance.text = text || ' '
    utterance.rate = 0.6
    utterance.pitch = 0.6

    return {
      utterance,
      pause,
    }
  }

  const speak = (index, utteranceInfo = makeUtterance(verses[index])) =>
    new Promise((resolve, reject) => {
      if (isPlaying.current) {
        setCurrentVerse(index)

        utteranceInfo.utterance.addEventListener('end', () => {
          // @ts-ignore
          currentTimeout.current = setTimeout(resolve, utteranceInfo.pause)
          setCurrentVerse(-1)
        })
        speechSynthesis.speak(utteranceInfo.utterance)
      } else {
        reject('Not playing')
      }
    })

  const play = useCallback(() => {
    const utteranceInfos = verses.map<UtteranceInfo>(makeUtterance)

    utteranceInfos
      .reduce(
        (last, utteranceInfo, index) =>
          last.then(() => speak(index, utteranceInfo)),
        Promise.resolve()
      )
      .catch(console.log)
      .finally(() => (isPlaying.current = false))
  }, [verses])

  if (!loaded) {
    return <>Loading...</>
  }

  return (
    <form
      style={{
        display: 'flex',
        flexDirection: 'column',
        maxWidth: '100%',
      }}
    >
      <input
        placeholder="Pick a title..."
        type="text"
        value={title}
        style={{
          fontSize: '2em',
          color: 'black',
        }}
        onChange={(e) => setTitle(e.target.value)}
      />
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
            isPlaying.current = true
            play()
          }}
        >
          Play
        </button>
        <button
          type="button"
          onClick={() => {
            isPlaying.current = false
            clearTimeout(currentTimeout.current)
          }}
        >
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
                flexBasis: '100px',
                padding: '10px',
                margin: '10px',
                border: '2px solid black',
                borderRadius: '10px',
                backgroundColor: currentVerse === index ? 'black' : 'white',
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
                  value={verse.text}
                  onChange={(e) => {
                    updateVerses({ index, verse: { text: e.target.value } })
                  }}
                />
              </label>
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
                  isPlaying.current = true
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
          style={{ padding: '10px', display: 'flex', flexDirection: 'column' }}
        >
          <small>Sharable QR Code:</small>
          <img
            style={{ maxWidth: '100px', width: '100%' }}
            alt="QR Code"
            src={qrURL}
          />
        </div>
      )}
    </form>
  )
}

render(<App />, document.getElementById('app'))
