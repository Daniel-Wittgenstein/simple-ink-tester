

(function() {

    const ENDING_MAX_SNIPPET_LENGTH = 20

    const guideHtml = `
            <h1>SIMPLE INK TESTER - GUIDE</h1>
            <p>1. Export your Ink story as ".js" file, then import it into Simple Ink Tester
            by clicking the button on the start screen.<br>
            This is the file named "yourstorytitle.js" that is exported when you
            choose EXPORT in Inky. It's usually NOT named "ink.js" or "main.js" (unless that's your story name)! Also remember to export as JS, not as JSON!
            </p>

            <p>2. Click on "START A NEW RANDOM CLICK TEST NOW!"</p>

            <p>3. Simple Ink Tester will randomly pick choices and check if your story has errors.
            It catches errors like the flow running out or the user reaching a point where there are no choices anymore
            but the story has not ended.
            After each playthrough, Simple Ink Tester automatically starts a new playthrough.
            You will see a message like this: <i>I played through the story 17 times.</i>
            Obviously, this shows you how many times Simple Ink Tester has reached the/an end of the story.
            The longer you let it test, the more likely it is to find an error.</p>

            <p>4. If no errors occur, that's a good sign!</p>

            <p>5. If an error occurs, you will see a playthrough that shows you what choices were (randomly) picked
            to reach that error. You will also see a so-called <i>signature</i>. This is a string
            that looks somehow like this: "1/2/1/3/1". Make sure to copy that signature and save it to a file
            so you don't lose it. Now you can go and fix your error. Once you are confident that
            the error is fixed, export your updated story to a ".js" file and load it into Simple Ink Tester.
            But this time, click on the button "Start a Replay Test". This will open a window, where you should
            paste your signature. Simple Ink Tester will replay the exact same choices
            that led to the previous error. If the error is truly fixed, it should
            not appear again.</p>

            <p>6. Randomness caveat: in stories with randomness
            the same <i>signature</i> can lead to vastly different
            results. If you are testing stories with randomness, consider using
            Ink's SEED_RANDOM() function to make the random number generator
            predictable. Once you are done testing, you can remove
            the call to SEED_RANDOM().
            </p>

            <p>7. How signatures work: signatures are simply a list of
            numbers separated by a slash character. "1/2/1" means:
            choose the first choice, then choose the second choice,
            then choose the first choice, after that
            if the story is not over, start choosing
            at random. (Signatures start counting
            at 1 not at 0.)</p>

            <p>8. Testing big / complex stories:
            Simple Ink Tester picks choices entirely at random.
            If your game is structured in a certain way where
            the story mostly moves forward, this is usually fine.
            But if your story is full of dead-ends that end the game
            or loops that are hard to beat, Simple Ink Tester
            may keep choosing the same paths over and over again
            and never test other parts of your story.
            In this case, you can also use signatures
            to improve testing.<br><br>
            Let's assume that the first three choices in your game
            affect how the rest of the story plays out.
            You could run a replay test and enter the signature:
            "1/2/1". Now Simple Ink Tester will always choose
            the first choice, followed by the second choice,
            followed by the first choice. After that it will
            keep picking choices randomly. This allows
            you to test some paths more thoroughly.
            </p>
    `

    let stats
    resetStats()

    const TEXTS = {
        startRandomFirst: `START A NEW RANDOM CLICK TEST NOW! 🎲`,
        startRandom: `Start a new Random Click Test 🎲`,
        stopTest: "Stop Test",
    }

    console.warn = (warning) => {
        log(warning, {isWarning: true, perma: true})
    }

    const currentStory = {
        title: "",
    }

    const MAX_RUNTHROUGHS = 1000 //otherwise we end with
        //"too much recursion error" sooner or later

    const inkLibNames = ["ink-legacy-old", "inkjs2.1.0", "inkjs2.2.2", "inkjs2.3.0"]

    let ink, storyCont, story, clicks, runthroughs, isRunning

    let outputBox, outputBoxPerma, logContent, collectedContent, goButton,
        showSignat, inkJsSelector, fileSelector, otherStoryButton

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

    function openWindow(title, html) {
        const targetHtml = `
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${html}</title>
                    <style>
                        body {
                            margin: 14px;
                            font-size: 14px;
                            background-color: #222;
                            color: white;
                            font-family: sans-serif;
                        }
                    </style>
                </head>
                <body>
                    ${html}
                </body>
            </html>` 
        const win = window.open("", title, "toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=780,height=400,top=100,left=100")
        win.document.body.innerHTML = targetHtml
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
        hide(fileSelector)        
        show(replayButton)
        show(otherStoryButton)
        goButton.style.opacity = 1
        goButton.innerHTML = TEXTS.startRandomFirst
        goButton.onclick = goTest
    }

    function populateInkJsSelector() {
        for (const inkLibName of inkLibNames.reverse()) {
            inkJsSelector.innerHTML += `
                <option value="${inkLibName}">${inkLibName}</option>
            `
        }
    }

    function show(el) {
        el.style.display = "block"
    }

    function hide(el) {
        el.style.display = "none"
    }

    function start() {
        document.addEventListener("click", listener)

        function listener(event) {
            var element = event.target
            if (element.tagName == 'A' && element.classList.contains("snip-link")) {
                if (isRunning) {
                    alert("Stop the test first. Then you can inspect this info.")
                    return
                }
                const targetIndex = Number(element.getAttribute('data-index'))
                let i = -1
                for (const key of Object.keys(stats.endings).sort()) {
                    i++
                    if (i === targetIndex) {
                        const text = key
                        openWindow(`Ending Nr. ${i}`, `This ending occurred ${stats.endings[key]} times:<br><br>` + text)
                        return
                    }
                }
                alert("Cannot inspect.")
            }
        }

        document.getElementById('input-file')
            .addEventListener('change', getFile)
        logContent = ""
        outputBox = document.getElementById("output")
        outputBoxPerma = document.getElementById("output-perma")
        goButton = document.getElementById("go_button")
        replayButton = document.getElementById("replay_button")
        hide(replayButton)
        inkJsSelector = document.getElementById("inkjs-selector")
        fileSelector = document.getElementById("file-selector")
        otherStoryButton = document.getElementById("other_story_button")
        hide(otherStoryButton)
        populateInkJsSelector()
        loadInkjs()
    }

    function clearOutputBoxPerma() {
        console.log("clear shit")
        outputBoxPerma.innerHTML = ""
    }

    function startTesting(data = false) {
        clearEndingsDisplay()
        resetStats()
        hide(fileSelector)
        hide(inkJsSelector)
        hide(replayButton)
        hide(otherStoryButton)
        isRunning = true
        clearOutputBoxPerma()
        currentStory.title = document.getElementById("input-file").value
            .replace("C:\\fakepath\\", "")
        log("STORY: " + currentStory.title, {perma: true, isWarning: false})
        document.getElementById("input-file").value = ""
        if (data && !data.split) {
            data = false
        }
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
        goButton.innerHTML = TEXTS.startRandom
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
        goButton.innerHTML = TEXTS.stopTest
        goButton.classList.add('stop-button')
        goButton.onclick = stopTesting
    }

    window.stopTesting = () => {
        isRunning = false
        show(replayButton)
        show(otherStoryButton)
        goButton.innerHTML = TEXTS.startRandom
        goButton.classList.remove('stop-button')
        goButton.onclick = goTest
        for (const el of document.querySelectorAll(".snip-link")) {
            el.classList.remove("disabled-snip-link")
        }
    }

    window.openGuide = () => {
        openWindow(`GUIDE - SIMPLE INK TESTER`, guideHtml)
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
        let lastPs = ""
        let veryLastP
        while(story.canContinue) {
            let paragraphText = story.Continue()
            collectedContent.push({
                type: "text",
                content: paragraphText,
            })
            veryLastP = paragraphText + "\n"
            lastPs += veryLastP
        }
        let choices = story.currentChoices
        //console.log(choices)
        if (choices.length === 0) {
            runthroughs++
            cls()
            log("*** I played through the story " + runthroughs + " times. ***")
            log("(Using signature: "+showSignat+")")
            /*const wholeStoryDisplay = collectedContent
                .map(n => n.content.text ? "choice: " + n.content.text : n.content)
                .join("<br><br>")*/
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
                log(`Ran through story ${MAX_RUNTHROUGHS} times. Test completed.`)
                return
            }
            log("reached ending: " + veryLastP)
            doStep(true, orgData)
            addEnding(lastPs)
            setEndingsDisplay("Endings reached:<br>" + getEndingsShortDescr())
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


    function clearEndingsDisplay() {
        document.getElementById("endings").innerHTML = ""
    }

    function setEndingsDisplay(html) {
        document.getElementById("endings").innerHTML = html
    }

    function resetStats() {
        stats = {
            endings: {},
        }
    }

    function addEnding(text) {
        if (!stats.endings[text]) stats.endings[text] = 0
        stats.endings[text]++
    }

    function getEndingsShortDescr() {
        let out = ""
        let i = -1
        for (const key of Object.keys(stats.endings).sort()) {
            i++
            const amount = stats.endings[key]
            const num = ENDING_MAX_SNIPPET_LENGTH
            let keyShort = key
            if (keyShort.length > num * 2 + 2) {
                keyShort = key.substring(0, num) + "..." + key.substring(key.length - num)
            }
            out += `<a href="#" class="snip-link disabled-snip-link" data-index="${i}">${keyShort}: ${amount} times</a><br>`
        }
        return out
    }

    function getRndInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    function loadStory(tcontent) {
        storyCont = tcontent
    }
      

})()

