module.exports = {
    init: (app) => {
        // get feed contents
        app.get('/feed/:username', (req, res) => {
            db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                if (!account || !account.follows)
                    res.send([])
                else
                    db.collection('contents').find({
                        $and: [
                            { author: { $in: account.follows } },
                            { pa: null }
                        ]
                    }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                        res.send(contents)
                    })

            })
        })
        app.get('/feed/:username/:author/:link', (req, res) => {
            db.collection('contents').findOne({
                $and: [
                    { author: req.params.author },
                    { link: req.params.link }
                ]
            }, function (err, content) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { pa: null },
                                { ts: { $lte: content.ts } }
                            ]
                        }, { sort: { ts: -1 }, limit: 50 }).toArray(function (err, contents) {
                            res.send(contents)
                        })

                })
            })
        })

        // get feed by tag with limit by certain author
        // filter = author,tag,limit,ts(from, to)
        // $API_URL/filter?author=author1,author2,...,authorN&tag=tag1,tag2,...,tagN&limit=x&ts=tsfrom-tsto
        app.get('/feed/:username/:filter', (req, res) => {
            var filterParam = req.params.filter
            var filter = filterParam.split(':')
            var filterBy = filter[1]
            var filterAttrs = filterBy.split('&')

            var filterMap = {}
            var defaultKeys = ['authors', 'tags', 'limit', 'tsrange']
            var filterKeys = []

            for (var k=0; k<filterAttrs.length; k++) {
                var kv = filterAttrs[k].split('=')

                if (kv.length == 2) {
                    var key = kv[0]
                    filterKeys.push(key)
                    var val = kv[1]

                    if (key == 'authors') {
                        filterMap['authors'] = val.split(',')
                    } else if (key == 'tags') {
                        filterMap['tags'] = val.split(',')
                    } else if (key == 'limit') {
                        filterMap['limit'] = parseInt(val)
                    } else if (key == 'tsrange') {
                        filterMap['tsrange'] = val.split(',')
                    }
                }
            }

            for (var k=0; k<defaultKeys.length; k++) {
                var key = defaultKeys[k]

                if (filterKeys.includes(key) == false) {
                    if (key == 'authors') {
                        filterMap['authors'] = []
                        filterMap['authors'].push("all")
                    } else if (key == 'tags') {
                        filterMap['tags'] = []
                        filterMap['tags'].push("all")
                    } else if (key == 'limit') {
                        filterMap['limit'] = 50
                    } else if (key == 'tsrange') {
                        filterMap['tsrange'] = []
                        filterMap['tsrange'].push(0)
                        filterMap['tsrange'].push(Number.MAX_SAFE_INTEGER)
                    }
                }
            }

            authors = filterMap['authors']

            authors_in = []
            authors_ex = []
            for(var i=0; i<authors.length; i++) {
                if(authors[i].includes("^")) {
                    s = authors[i].substring(1, authors[i].length)
                    authors_ex.push(s)
                }
                else {
                    authors_in.push(authors[i])
                }
            }

            tags = filterMap['tags']

            tags_in = []
            tags_ex = []
            for(var i=0; i<tags.length; i++) {
                if(tags[i].includes("^")) {
                    s = tags[i].substring(1, tags[i].length)
                    tags_ex.push(s)
                } else {
                    tags_in.push(tags[i])
                }
            }

            limit = filterMap['limit']

            if(limit == -1) {
                limit = Number.MAX_SAFE_INTEGER
            }

            tsrange = filterMap['tsrange']
            if (tsrange.length == 2) {
                tsfrom = parseInt(tsrange[0]) * 1000
                tsto = parseInt(tsrange[1]) * 1000
            } else {
                return
            }

            if (authors.includes("all") && !tags.includes("all")) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else {
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                {
                                    $or: [
                                        {
                                            $and: [
                                                { 'json.tag': { $in: tags_in } },
                                                { 'json.tag': { $nin: tags_ex } },
                                            ],
                                        },
                                        {
                                            $and: [
                                                { votes: { $elemMatch: { tag: { $in: tags_in } } } },
                                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } }
                                            ]
                                        }
                                    ]
                                },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit}).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    }
                })
            } else if (!authors.includes("all") && !tags.includes("all")) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else {
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $in : authors_in } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                {
                                    $or: [
                                        {
                                            $and: [
                                                { 'json.tag': { $in: tags_in } },
                                                { 'json.tag': { $nin: tags_ex } },
                                            ],
                                        },
                                        {
                                            $and: [
                                                { votes: { $elemMatch: { tag: { $in: tags_in } } } },
                                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } }
                                            ]
                                        }
                                    ]
                                },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    }
                })
            } else if (authors.includes("all") && tags.includes("all")) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else {
                        db.collection('contents').find({
                            $and: [
                                { author: { $in: account.follows } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                { 'json.tag': { $nin: tags_ex } },
                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    }
                })

            } else if (!authors.includes("all")  && tags.includes("all")) {
                db.collection('accounts').findOne({ name: req.params.username }, function (err, account) {
                    if (!account.follows)
                        res.send([])
                    else {
                        db.collection('contents').find({
                            $and: [
                                { author: { $in : authors_in } },
                                { author: { $nin : authors_ex } },
                                { pa: null },
                                { 'json.tag': { $nin: tags_ex } },
                                { votes: { $elemMatch: { tag: { $nin: tags_ex } } } },
                                { ts: { $gte: tsfrom } },
                                { ts: { $lte: tsto } },
                            ]
                        }, { sort: {ts:-1}, limit: limit }).toArray(function (err, contents) {
                            res.send(contents)
                        })
                    }
                })
            }
        })
    }
}
