

(function() {

    console.warn = (warning) => {
        log(warning, {isWarning: true, perma: true})
    }

    const MAX_RUNTHROUGHS = 1000 //otherwise we end with
        //"too much recursion error" sooner or later

    const inkLibNames = ["inkjs2.1.0", "inkjs2.2.2", "inkjs2.3.0"]

    let ink, storyCont, story, clicks, runthroughs, isRunning

    let outputBox, outputBoxPerma, logContent, collectedContent, goButton, showSignat

    let orgData

    let interval = 0

    window.onload = start

    const inkLibs = {}

    function loadInkjs() {
        for (const key of inkLibNames) {
            inkLibs[key.replace("inkjs", "")] = window[key]
        }
        useInkLibVersion("2.3.0")
    }

    function useInkLibVersion(version) {
        ink = inkLibs[version]
    }

    function getFile(event) {
        const input = event.target
        if ('files' in input && input.files.length > 0) {
            placeFileContent(input.files[0])
        }
    }

    function placeFileContent(file) {
        readFileContent(file).then(content => {
            loadedStoryDone(content)
        }).catch(error => console.log(error))
    }

    function readFileContent(file) {
        const reader = new FileReader()
        return new Promise((resolve, reject) => {
            reader.onload = event => resolve(event.target.result)
            reader.onerror = error => reject(error)
            reader.readAsText(file)
        })
    }

    function loadedStoryDone(content) {
        //if (!content.startsWith('var storyContent')) {
        //    console.log("WARNING: This does not seem to be a story.js file.")
        //}
        let rest = content.split('{').slice(1).join('{')
        rest = rest.trim()
        if (rest.endsWith(";")) rest = rest.substring(0, rest.length - 1)
        rest = "{" + rest
        let obj
        try {
            obj = JSON.parse(rest)
        } catch(e) {
            alert("This does not seem to be a valid story.js file.")
            return
        }
        loadStory(obj)
        startTesting()
        goButton.style.opacity = 1
        goButton.innerHTML = "Stop Test"
        goButton.onclick = stopTesting
    }

    function start() {     
        document.getElementById('input-file')
            .addEventListener('change', getFile)
        logContent = ""
        outputBox = document.getElementById("output")
        outputBoxPerma = document.getElementById("output-perma")
        goButton = document.getElementById("go_button")
        loadInkjs()
    }

    function clearOutputBoxPerma() {
        outputBoxPerma.innerHTML = ""
    }

    function startTesting(data = false) {
        clearOutputBoxPerma()
        if (data && !data.split) {
            data = false
        }
        isRunning = true
        if (!ink) {
            alert (`inkjs was not loaded`)
            return false
        }
        if (!storyCont) {
            alert (`You need to load a story.js file first.`)
            return false
        }
        runthroughs = 0
        story = new ink.Story(storyCont)
        story.onError = (msg, type) => {
            logError(type, msg)
            stopTesting()
        }
        if (data) {
            data = data.split("/")
        }
        try {
            doStep(true, data)
        } catch(err) {
            //js error (for example: too much recursion):
            outputBox.innerHTML += `<p class="error">${err}</p>`
        }
        return true
    }
    
    function logError(type, msg) {
        outputBox.innerHTML = ""
        outputBox.innerHTML += `<p class="error">${type}: ${msg}</p>`
        console.log(collectedContent)
        outputBox.innerHTML += `<p>(Currently there are ${story.currentChoices.length} choices for
            the player to choose from.)</p>`
        
        let signature = ""
        for (let item of collectedContent) {
            if (item.type === "choice") {
                signature += (item.content.index + 1) + "/"
            }
        }
        outputBox.innerHTML += "Signature: <textarea>" + signature+"</textarea>"
    
        renderHistory(collectedContent)
        outputBox.innerHTML += `<p class="error">${type}: ${msg}</p>`
        goButton.innerHTML = "Start Random Test"
        goButton.onclick = goTest
    }

    window.replay = () => {
        stopTesting()
        setTimeout( () => {
            let data = prompt("Paste a valid signature:")
            if (!data) return
            goTest(data)
        }, 500)
    }

    window.goTest = (data = false) => {
        outputBox.innerHTML = ""
        orgData = false
        let result = startTesting(data)
        if (!result) return
        goButton.innerHTML = "Stop Test"
        goButton.onclick = stopTesting
    }

    window.stopTesting = () => {
        isRunning = false
        goButton.innerHTML = "Start Random Test"
        goButton.onclick = goTest
    }

    function renderHistory(collected) {
        let out = ""
        for (let item of collected) {
            if (item.type === "text") {
                out += `<p>${item.content}</p>`
            } else if (item.type === "choice") {
                out += `<p class="choice">
                    <span class="number">${item.content.index+1}.</span>&nbsp;
                    ${item.content.text}</p>`
            }
            
        }
        outputBox.innerHTML += out
    }

    function log(txt, options = {isWarning: false, perma: false}) {
        if (!isRunning) return
        let content = ""
        if (options.isWarning) {
            content = `<span style="background: #aa0; color: #000;">
                ${txt}</span>` + "<br>"
        } else {
            content = txt + "<br>"
        }
        if (options.perma) {
            outputBoxPerma.innerHTML += content    
        } else {
            outputBox.innerHTML += content
        }
    }

    function cls() {
        if (!isRunning) return
        logContent = ""
        outputBox.innerHTML = logContent
    }

    function doStep(restart, data) {
        if (!isRunning) return
        if (restart) {
            if (data) {
                orgData = [...data]
                showSignat = data.join("/")
            } else {
                showSignat = "random"
            }
            collectedContent = []
            clicks = 0
            //console.log("RESTARTING STORY")
            story.ResetState()
        }
        let lastP
        while(story.canContinue) {
            let paragraphText = story.Continue()
            collectedContent.push({
                type: "text",
                content: paragraphText,
            })
            lastP = paragraphText
        }
        let choices = story.currentChoices
        //console.log(choices)
        if (choices.length === 0) {
            runthroughs++
            cls()
            log("*** I played through the story " + runthroughs + " times. ***")
            log("(Using signature: "+showSignat+")")
            log("reached end: " + lastP)
            log("It took me " + clicks + " clicks to reach an ending.")
            let msg = "No errors found."
            let r = runthroughs
            if (r >= 100) {
                msg = "No errors yet. Still going strong!"
            } else if (r >= 50) {
                msg = "Still no errors."
            }
            log("<span class='no-errors'>"+msg+"</span>")
            if (runthroughs >= MAX_RUNTHROUGHS) {
                log("Ran through story ${MAX_RUNTHROUGHS}. Test completed.")
                return
            }
            doStep(true, orgData)
            return
        }
        
        let index
        if (data) {
            index = data.shift()
            if (!index) {
                index = getRndInt(0, choices.length - 1)
            } else {
                index = Number(index) - 1
            }
        } else {
            index = getRndInt(0, choices.length - 1)
        }
        
        collectedContent.push({
            type: "choice",
            content: choices[index],
        })
        try {
            story.ChooseChoiceIndex(index)
        } catch(e) {
            console.log(e)
            stopTesting()
            outputBox.innerHTML = `${e} - You probably specified an invalid choice number inside the signature string.`
            return
        }
        setTimeout( () => {
            clicks++
            doStep(false, data)
        }, interval)
    }

    function getRndInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    function loadStory(tcontent) {
        storyCont = tcontent
    }
      

})()

