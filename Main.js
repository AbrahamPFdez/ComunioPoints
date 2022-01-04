const Nightmare = require('nightmare')
const { user, password } = require('./credentials.json')

const HOME_URL = 'https://www.comunio.es/'
const RANKING_URL = 'https://www.comunio.es/standings/season/matchday'
const REWARDS_URL = 'https://www.comunio.es/setup/clubs/rewardsAndDisciplinary'
const BASE_SALARY = 1000000
const POINT_VALUE = 14000

const nightmare = Nightmare({
    waitTimeout: 60000
})

var player_list = null
var player_index_list = null

class Player {
    constructor(name, position) {
        this.name = name
        this.position = position
        this.points = 0
    }
    get pay() {
        let pay = BASE_SALARY - this.points * POINT_VALUE
        return (pay <= 0) ? 1 : pay
    }
}

var createPlayer = (value, index) => {
    return new Player(value.trim(), index + 1);
}

async function post_login() {
    console.log("Logging in with {" + user + ", " + password + "}")
    await nightmare
        .goto(HOME_URL)
        .wait("a.login-btn.registration-btn-fill")
        .click("a.login-btn.registration-btn-fill")
        .wait("#input-login")
        .type("#input-login", user).type("#input-pass", password).click('#login-btn-modal')
        .wait("#top-bar-user-name")
}

async function get_week_ranking_players() {
    console.log("Getting players ranking ...")
    await nightmare.goto(RANKING_URL)
        .wait(".name.text-to-slide.whitespace_nowrap")
        .evaluate(
            () => Array.from(document.querySelectorAll(".name.text-to-slide.whitespace_nowrap")).map(e => e.textContent)
        )
        .then((player_name_list) => {
            player_list = Array.from(player_name_list).map(createPlayer)
        })
        .catch((error) => {
            console.error(error)
        })
}

async function get_week_ranking_points() {
    console.log("Getting players points ...")
    await nightmare
        .evaluate(
            () => Array.from(document.querySelectorAll("div.standingstable_row_left > div.click-and-hover-area > div.points-inactive > span")).map(e => e.textContent)
        )
        .then((player_points_list) => {
            let formatted_list = Array.from(player_points_list).map(e => (Number.isNaN(parseInt(String(e).substring(1)))) ? 0 : parseInt(String(e).substring(1)))
            formatted_list.forEach((value, index) => { player_list[index].points = value })
        })
}

async function get_payment_queue() {
    console.log("Making payments ...")
    await nightmare
        .goto(REWARDS_URL)
        .wait("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div")
        .click("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div")
        .wait(".select_open .select_option span:last-child")
        .evaluate(
            () => Array.from(document.querySelectorAll(".select_open .select_option span:last-child")).map(e => e.textContent)
        )
        .then((payment_indexes) => {
            player_index_list = payment_indexes
        })
        .catch((error) => {
            console.error(error)
        })
}

function post_payments() {
    return player_index_list.reduce((stack, value, index) => {
        return stack.then(() => {
            return do_pay(value, index)
        })
    }, Promise.resolve());
}

function do_pay(value, index) {
    return new Promise((resolve) => {
        setTimeout(() => {
            let player = player_list.find(player => player.name === value)
            console.log("[" + index + "] " + player.position + "º - " + player.name + ': ' + player.pay + "€.")
            nightmare
                .wait("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div")
                .click("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div")
                .wait("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div > div.select_options.pos_abs > div:nth-child(" + (index + 1) + ")")
                .click("#cont-setup-impose-penalties > div.margin_left_10 > div:nth-child(3) > div > div.select_options.pos_abs > div:nth-child(" + (index + 1) + ")")
                .wait("#cont-setup-impose-penalties input")
                .insert("#cont-setup-impose-penalties input", false)
                .insert("#cont-setup-impose-penalties input", player.pay)
                .type("#cont-setup-impose-penalties textarea", player.position)
                .click(".button")
            if (index + 1 === player_list.length) {
                nightmare.end()
            }
            nightmare.then(() => { console.log("Done") })
                .catch((error) => { console.error(error) })
            resolve();
        }, 5000);
    });
}

const Main = async () => {
    await post_login()
    await get_week_ranking_players()
    await get_week_ranking_points()
    await get_payment_queue()
    post_payments().then(() => {
        console.log("Finished")
    })
}

Main()

