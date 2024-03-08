import React, { useEffect, useCallback, useRef, useState } from 'react'

import { sleep } from '../utils/getFromContentScript'
import { getSimplifiedDom } from '../utils/simplifyDOM'
import { getObjectId } from '../utils/handleingDOMOperations'
import { sendDomGetCommand } from '../utils/sendDomGetCommands'
import { attachDebugger, detachDebugger } from '../utils/chromeDebugger'

export default function ExecutionController({ tabId, user_prompt, apiKey, setTaskState }: {
  tabId: number
  apiKey: string
  user_prompt: string
  setTaskState: React.Dispatch<React.SetStateAction<"" | "executing" | "terminated">>
}) {

  const firstTime = useRef<boolean>(true)
  const [tasksList, setTasksList] = useState<string[]>([])
  const [terminateStatus, setterminateStatus] = useState<boolean>(false)


  const taskExecutionRef = useRef<ITaskExecutionState>({
    isTaskActive: true,
    aboutPreviousTask: [],
    currentState: 'noactive',
    iterationNumber: 0
  })

  const executePrompt = useCallback(async () => {
    try {
      console.log("Executing prompt")

      await attachDebugger(tabId)

      for (let i = 0; i < 5; i++) {
        if (!taskExecutionRef.current.isTaskActive) break;
        console.log(`---------------------            step ${i}            ----------------------------------------`)

        const compact_dom = await getSimplifiedDom()
        if (!taskExecutionRef.current.isTaskActive) break;

        const taskJson = await sendDomGetCommand(apiKey, { user_prompt, compact_dom: compact_dom.outerHTML }, taskExecutionRef.current.aboutPreviousTask)
        if (!taskExecutionRef.current.isTaskActive) break;

        // console.log(taskJson.tasks, taskJson["tasks"], Array.isArray(taskJson["tasks"]), taskJson)

        if (taskJson && Array.isArray(taskJson["tasks"])) {
          const tasks = taskJson.tasks
          console.log(i, "\tcurrent tasks", tasks)


          for (const { about, command } of tasks) {
            if (!taskExecutionRef.current.isTaskActive) break;

            // const command = commands[i]
            console.log(about, "The command", command)
            const id = parseInt(command.id as string)
            const objectId = await getObjectId(id, tabId);
            console.log("Unique id", objectId, command)


            if (!objectId) continue;

            // const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

            // const tabId = tabs[0].id;
            // return activeTab.id
            // const code = `document.getElementById('${objectId}').click();`;
            // console.log("code", code, "executing")
            // chrome.tabs.executeScript(activeTab.id, { code: code });

            if (!taskExecutionRef.current.isTaskActive) break;
            const res = await chrome.debugger.sendCommand({ tabId }, "Runtime.callFunctionOn", {
              objectId, // The objectId of the DOM node
              functionDeclaration: "function() { this.click(); }", // Define a function to call click() on the node
              returnByValue: false
            })

            taskExecutionRef.current = {
              ...taskExecutionRef.current,
              aboutPreviousTask: taskExecutionRef.current.aboutPreviousTask.slice().concat([about])
            }

            if (!taskExecutionRef.current.isTaskActive) break;


            if (command.tag === 'a') {
              console.log("Sleeping for 8 sec")
              setTasksList((prev) => {
                return prev.slice().concat([about, "sleeping for 8 sec"])
              })
              await sleep(8000)
            } else {
              console.log("Sleeping for 2 sec")
              setTasksList((prev) => {
                return prev.slice().concat([about])
              })
              await sleep(2000)
            }

            console.log("task", i, "  done", about)

            // .catch((err) => {
            //   console.error("While runing debugger", err)
            // }).finally(() => {
            //   detachDebugger(tabId)
            // })
          }

          console.log("got commands", tasks)
        }

        console.log("Detaching debugger")
      }
      detachDebugger(tabId)
    } catch (err) {
      detachDebugger(tabId)
      console.error("While executing commads", err)
    }

  }, [tabId, user_prompt, apiKey, setTaskState])

  useEffect(() => {
    if (firstTime) {
      firstTime.current = false
      executePrompt()
    } else {

    }

    return () => {
      console.log("Closing")
      firstTime.current = false
      detachDebugger(tabId)
    }
  }, [])

  return (
    <div className='flex flex-col justify-end'>
      <div className='w-full'>
        <button
          onClick={() => {
            taskExecutionRef.current = {
              ...taskExecutionRef.current,
              isTaskActive: false
            }
            setterminateStatus(true)
            sleep(10000).finally(() => {
              setTaskState('terminated')
            })
          }}
          disabled={terminateStatus}
          className='px-3 py-1.5 rounded-xl ml-auto bg-red-500 text-white font-bold hover:bg-red-600'>
          {
            !terminateStatus &&
            <span>Terminate</span>
          }
          {
            terminateStatus &&
            <span>Terminating</span>
          }
        </button>
      </div>
      <ul className='border mt-5 max-h-[200px] overflow-y-auto'>
        {
          tasksList.map((task, index) => {
            return <li key={index} className='text-start flex items-center border-b'>
              <span className={`px-2 py-0.5 text-white ${(task.slice(0,5) === "sleep")?'bg-yellow-500':'bg-blue-500'}`}>{index}.</span>
              <span className='px-2 py-0.5'>{task}</span>
            </li>
          })
        }
      </ul>
    </div>
  )
}

interface ITaskExecutionState {
  isTaskActive: boolean
  aboutPreviousTask: string[]
  currentState: string
  iterationNumber: number
}
// executePrompt(userPrompt, apiKey, tabId)


// async function executeAction(user_prompt: string, apiKey: string, tabId: number) {
//   try {
//     console.log("Executing prompt")

//     await attachDebugger(tabId)

//     const compact_dom = await getSimplifiedDom()
//     const taskJson = await sendDomGetCommand(apiKey, { user_prompt, compact_dom: compact_dom.outerHTML }, [])

//     console.log(taskJson.tasks, taskJson["tasks"], Array.isArray(taskJson["tasks"]), taskJson)

//     if (taskJson && Array.isArray(taskJson["tasks"])) {
//       const tasks = taskJson.tasks
//       console.log("tasks", tasks)

//       for (const { about, command } of tasks) {
//         // const command = commands[i]
//         console.log(about, "The command", command)
//         const id = parseInt(command.id as string)
//         const objectId = await getObjectId(id, tabId);
//         console.log("Unique id", objectId, command)


//         if (!objectId) continue;

//         // const tabs = await chrome.tabs.query({ active: true, currentWindow: true });

//         // const tabId = tabs[0].id;
//         // return activeTab.id
//         // const code = `document.getElementById('${objectId}').click();`;
//         // console.log("code", code, "executing")
//         // chrome.tabs.executeScript(activeTab.id, { code: code });

//         const res = await chrome.debugger.sendCommand({ tabId }, "Runtime.callFunctionOn", {
//           objectId, // The objectId of the DOM node
//           functionDeclaration: "function() { this.click(); }", // Define a function to call click() on the node
//           returnByValue: false
//         })

//         await sleep(2000)
//         console.log("task 1 done", about)
//         // .catch((err) => {
//         //   console.error("While runing debugger", err)
//         // }).finally(() => {
//         //   detachDebugger(tabId)
//         // })
//       }

//       console.log("got commands", tasks)
//     }

//     console.log("Detaching debugger")
//     detachDebugger(tabId)
//   } catch (err) {
//     detachDebugger(tabId)
//     console.error("While executing commads", err)
//   }
// }