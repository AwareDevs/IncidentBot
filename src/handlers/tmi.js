const fs = require("fs")
const client = require("../services/tmi")
const ChannelModel = require("../models/Channel")
const log = require("./logger")
const defaultPrefix = "-"

client.commands = {}

fs.readdir(__dirname + "/../commands/twitch", (err, files) => {
    if (err) return log.error(err)

    const jsfile = files.filter((f) => f.split(".").pop() == "js")
    jsfile.forEach((f, i) => {
        var pull = require(`../commands/twitch/${f}`)
        pull.cooldownUsers = []
        client.commands[pull.config.name] = pull
    })
})

async function getCustomPrefix(channel) {
    const result = await ChannelModel.findOne({ twitch_name: channel }).catch(
        (err) => {
            log.error("Ocorreu um erro ao buscar prefixo do canal: " + err)
        }
    )
    return result?.customPrefix
}

function setUserCooldown(c, tags) {
    client.commands[c.config.name].cooldownUsers.push(tags["user-id"])
    setTimeout(() => {
        client.commands[c.config.name].cooldownUsers = client.commands[
            c.config.name
        ].cooldownUsers.filter((i) => i !== tags["user-id"])
    }, c.config.cooldown)
}

client.on("message", async (channel, tags, message, self) => {
    if (self) return
    channel = channel.replace("#", "") // Remove o padrão dos canais começarem com #
    const prefix = (await getCustomPrefix(channel)) || defaultPrefix

    let args = message.slice(prefix.length).trim().split(/ +/g)
    var cmd = args.shift().toLowerCase()
    var command =
        client.commands[cmd] || client.commands[client.aliases.get(cmd)]

    if (!command || !message.startsWith(prefix)) return
    if (command.cooldownUsers.includes(tags["user-id"])) return
    if (
        command.config.adminOnly &&
        !["feridinha", "bytter_", "lobisco25"].includes(tags.username)
    )
        return

    try {
        command.run(client, args, channel, tags, message)
    } catch (err) {
        log.error(`Ocorreu um erro ao rodar um comando: ${err}`)
    }

    setUserCooldown(command, tags)
})
