var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const saltRounds = 10;
const { isLoggedIn } = require('../helpers/util')


/* GET home page. */
module.exports = function (db) {
  router.get('/', function (req, res, next) {
    res.render('login', {
      success: req.flash('success'),
      error: req.flash('error')
    });
  });

  router.get('/dashboard', isLoggedIn, function (req, res, next) {
    res.render('dashboard/dashboard', { user: req.session.user, current: 'dashboard' });
  });
  
  router.get('/users', isLoggedIn, function (req, res, next) {
    db.query('SELECT * FROM users', (err, data) => {
      if (err) return res.send(err)
      res.render('users/users', { user: req.session.user, current: 'users', users: data.rows });
    })
  });

  router.get('/datatable', async (req, res) => {
    let params = []

    if (req.query.search.value) {
      params.push(`name ilike '%${req.query.search.value}%'`)
    }
    if (req.query.search.value) {
      params.push(`email ilike '%${req.query.search.value}%'`)
    }


    const limit = req.query.length
    const offset = req.query.start
    const sortBy = req.query.columns[req.query.order[0].column].data
    const sortMode = req.query.order[0].dir

    const total = await db.query(`select count(*) as total from users${params.length > 0 ? ` where ${params.join(' or ')}` : ''}`)
    const data = await db.query(`select * from users${params.length > 0 ? ` where ${params.join(' or ')}` : ''} order by ${sortBy} ${sortMode} limit ${limit} offset ${offset} `)
    const response = {
      "draw": Number(req.query.draw),
      "recordsTotal": total.rows[0].total,
      "recordsFiltered": total.rows[0].total,
      "data": data.rows
    }
    res.json(response)
  })

  router.get('/sales', isLoggedIn, function (req, res, next) {
    res.render('Sales/sales', { user: req.session.user, current: 'sales' });
  });

  router.get('/users/edit/:userid', isLoggedIn, function (req, res, next) {
    db.query('SELECT * FROM users WHERE userid = $1', [Number(req.params.userid)], (err, data) => {
      if (err) return res.send(err)
      if (data.rows.length == 0) return res.send('data not found')
      res.render('users/edit', { user: req.session.user, current: 'edit', item: data.rows[0] });
    })
  });

  router.get('/users/add', isLoggedIn, function (req, res, next) {
    res.render('users/add', {
      user: req.session.user, current: 'add', success: req.flash('success'),
      error: req.flash('error')
    });
  });

  router.get('/logout', isLoggedIn, function (req, res, next) {
    req.session.destroy(function (err) {
      res.redirect('/');
    })
  });

  router.post('/', async (req, res) => {
    try {
      const { email, password } = req.body

      const { rows: emails } = await db.query('SELECT * FROM users WHERE email = $1', [email])

      if (emails.length == 0) {
        req.flash('error', "email doesn't exist")
        return res.redirect('/')
      }


      if (!bcrypt.compareSync(password, emails[0].password)) {
        req.flash('error', "passowrd doesn't match")
        return res.redirect('/')
      }
      // bikin session
      const user = emails[0]
      delete user['password']

      req.session.user = user
      res.redirect('/dashboard')
    } catch (err) {
      req.flash('err', err)
      return res.redirect('/')
    }

  })

  router.post('/users/add', async (req, res) => {
    try {
      const { email, name, password, role } = req.body

      const { rows: emails } = await db.query('SELECT * FROM users WHERE email = $1', [email])
      if (emails.length > 0) {
        req.flash('error', 'email already exist')
        return res.redirect('/users/add')
      }

      const hash = bcrypt.hashSync(password, saltRounds);
      await db.query('INSERT INTO users (email, name, password, role) VALUES ($1, $2, $3, $4)', [email, name, hash, role])
      req.flash('succes', 'account kamu berhasil di buat, silahkan login')
      res.redirect('/users')
    } catch (err) {
      req.flash('err', err)
      return res.redirect('/users/add')
    }
  })

  router.post('/users/edit/:userid', async (req, res) => {
    try {
      const { userid } = req.params
      const { email, name, role } = req.body

      await db.query('UPDATE users SET email=$1, name=$2, role=$3 WHERE userid=$4', [email, name, role, userid])
      res.redirect('/users')
    } catch (err) {
      req.flash('err', err)
      return res.redirect('/users/edit/:userid')
    }
  })


  router.get('/users/delete/:userid', async (req, res) => {
    try {
      const { userid } = req.params

      const { rows: data } = await db.query('DELETE FROM users WHERE userid = $1', [userid])
      res.redirect('/users')
    } catch (err) {
      res.send(err)
    }
  })


  return router;
}



