

(function() {

    
    let ink, story_cont, story, clicks, runthroughs, is_running

    let output_box, log_content, collected_content, go_button, show_signat

    let org_data

//    let loaded_story_content

    let interval = 0

    window.onload = start


    function getFile(event) {
        const input = event.target
        if ('files' in input && input.files.length > 0) {
            placeFileContent(input.files[0])
        }
    }

    function placeFileContent(file) {
        readFileContent(file).then(content => {
            loaded_story_done(content)
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

    function loaded_story_done(content) {
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
        load_story(obj)
        start_testing()
        go_button.style.opacity = 1
        go_button.innerHTML = "Stop Test"
        go_button.onclick = stop_testing
    }

    function start() {     
        document.getElementById('input-file')
            .addEventListener('change', getFile)
        log_content = ""
        output_box = document.getElementById("output")
        go_button = document.getElementById("go_button")
        load_inkjs(inkjs)
    }


    function start_testing(data = false) {
        if (data && !data.split) {
            data = false
        }
        is_running = true
        if (!ink) {
            alert (`inkjs was not loaded`)
            return false
        }
        if (!story_cont) {
            alert (`You need to load a story.js file first.`)
            return false
        }
        runthroughs = 0
        story = new inkjs.Story(story_cont)
        story.onError = (msg, type) => {
            log_error(msg, type)
            stop_testing()
        }
        if (data) {
            data = data.split("/")
        }
        do_step(true, data)
        return true
    }
    
    function log_error(type, msg) {
        output_box.innerHTML = ""
        output_box.innerHTML += `<p class="error">${type}: ${msg}</p>`
        console.log(collected_content)
        output_box.innerHTML += `<p>(Currently there are ${story.currentChoices.length} choices for
            the player to choose from.)</p>`
        
        let signature = ""
        for (let item of collected_content) {
            if (item.type === "choice") {
                signature += (item.content.index + 1) + "/"
            }
        }
        output_box.innerHTML += "Signature: <textarea>" + signature+"</textarea>"
    
        render_history(collected_content)
        output_box.innerHTML += `<p class="error">${type}: ${msg}</p>`
        go_button.innerHTML = "Start Random Test"
        go_button.onclick = go_test
    }

    window.replay = () => {
        stop_testing()
        setTimeout( () => {
            let data = prompt("Paste a valid signature:")
            if (!data) return
            go_test(data)
        }, 500)
    }

    window.go_test = (data = false) => {
        output_box.innerHTML = ""
        org_data = false
        let result = start_testing(data)
        if (!result) return
        go_button.innerHTML = "Stop Test"
        go_button.onclick = stop_testing
    }

    window.stop_testing = () => {
        is_running = false
        go_button.innerHTML = "Start Random Test"
        go_button.onclick = go_test
    }

    function render_history(collected) {
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
        output_box.innerHTML += out
    }

    function log(txt) {
        if (!is_running) return
        log_content += txt + "<br>"
        output_box.innerHTML = log_content
    }

    function cls() {
        if (!is_running) return
        log_content = ""
        output_box.innerHTML = log_content
    }

    function do_step(restart, data) {
        if (!is_running) return
        if (restart) {
            if (data) {
                org_data = [...data]
                show_signat = data.join("/")
            } else {
                show_signat = "random"
            }
            collected_content = []
            clicks = 0
            //console.log("RESTARTING STORY")
            story.ResetState()
        }
        let last_p
        while(story.canContinue) {
            let paragraph_text = story.Continue()
            collected_content.push({
                type: "text",
                content: paragraph_text,
            })
            //console.log(paragraph_text)
            last_p = paragraph_text
        }
        let choices = story.currentChoices
        //console.log(choices)
        if (choices.length === 0) {
            //console.log("REACHED END:", last_p)
            runthroughs++
            cls()
            log("*** I played through the story " + runthroughs + " times. ***")
            log("(Using signature: "+show_signat+")")
            log("reached end: " + last_p)
            log("It took me " + clicks + " clicks to reach an ending.")
            let msg = "No errors found."
            let r = runthroughs
            if (r >= 100) {
                msg = "No errors yet. Still going strong!"
            } else if (r >= 50) {
                msg = "Still no errors."
            }
            log("<span class='no-errors'>"+msg+"</span>")

            do_step(true, org_data)
            return
        }
        
        let index
        if (data) {
            index = data.shift()
            if (!index) {
                index = get_rnd_int(0, choices.length - 1)
            } else {
                index = Number(index) - 1
            }
        } else {
            index = get_rnd_int(0, choices.length - 1)
        }
        
        collected_content.push({
            type: "choice",
            content: choices[index],
        })
        try {
            story.ChooseChoiceIndex(index)
        } catch(e) {
            console.log(e)
            stop_testing()
            output_box.innerHTML = `${e} - You probably specified an invalid choice number inside the signature string.`
            return
        }
        setTimeout( () => {
            clicks++
            do_step(false, data)
        }, interval)
    }

    function get_rnd_int(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    function load_story(tcontent) {
        story_cont = tcontent
    }
    
    function load_inkjs(tinkjs) {
        ink = tinkjs
    }
      

})()

