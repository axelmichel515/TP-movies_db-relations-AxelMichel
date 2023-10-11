
const db = require("../database/models");
const sequelize = db.sequelize;
const { Op } = require("sequelize");
//const { title } = require("process");
const moment = require('moment');
const Actor_Movie = require("../database/models/Actor_Movie");

//Aqui tienen una forma de llamar a cada uno de los modelos
// const {Movies,Genres,Actor} = require('../database/models');

//Aquí tienen otra forma de llamar a los modelos creados
const Movies = db.Movie;
const Genres = db.Genre;
const Actors = db.Actor;

const moviesController = {
  list: (req, res) => {
    db.Movie.findAll({
        include : ['genre']
    }).then((movies) => {
      res.render("moviesList.ejs", { movies });
    });
  },
  detail: (req, res) => {
    
    db.Movie.findByPk(req.params.id,{
      include : ['actors']
    }).then((movie) => {
      return res.render("moviesDetail.ejs", { ...movie.dataValues ,moment});
    });
  },
  new: (req, res) => {
    db.Movie.findAll({
      order: [["release_date", "DESC"]],
      limit: 5,
    }).then((movies) => {
      res.render("newestMovies", { movies,moment });
    });
  },
  recomended: (req, res) => {
    db.Movie.findAll({
      where: {
        rating: { [db.Sequelize.Op.gte]: 8 },
      },
      order: [["rating", "DESC"]],
    }).then((movies) => {
      res.render("recommendedMovies.ejs", { movies });
    });
  },
  //Aqui dispongo las rutas para trabajar con el CRUD
  add: function (req, res) {
    const movie = db.Movie.findByPk(req.params.id,{
      include : ['actors']
    })

    const genres = db.Genre.findAll({
        order: ['name']
    })
    const actors = db.Actor.findAll({
      order:[
        ['first_name','ASC'],
        ['last_name','ASC']
      ]
    })
    Promise.all([genres,actors,movie])
    .then(([genres,actors]) => {
        return res.render('moviesAdd',{
            genres,
            actors,
            movie
        })
    })
    .catch(error => console.log(error))
  },
  create: function (req, res) {
    
    const {title, rating, awards, release_date, length, genre_id} = req.body;

    const actors = [req.body.actors].flat();
    console.log(actors);

    db.Movie.create({
        title: title.trim(),
        rating,
        awards,
        release_date,
        length,
        genre_id,
        image : req.file ? req.file.filename : null
    })
    .then((movie) => {
      if(actors){
      const actorsDB = actors.map(actor =>{
        return {
          movie_id : movie.id,
          actor_id : actor
        }
      })
      db.Actor_Movie.bulkCreate(actorsDB,{
        validate : true
      }).then(() => { 
        console.log('Actores agregados correctamente')

      return res.redirect('/movies');
      })
     } else {
      return res.redirect('/movies');
     }
    })
    .catch(error => console.log(error))
  },
  edit: function (req, res) {
    const genres = db.Genre.findAll({
      order: ['name'],
  })
    const movie = db.Movie.findByPk(req.params.id,{
      include : ['actors']
    })
    const actors = db.Actor.findAll({
      order:[
        ['first_name','ASC'],
        ['last_name','ASC']
      ]
    })

    Promise.all([genres,movie,actors])
    .then(([genres,movie,actors]) => {
        return res.render('moviesEdit',{
            genres,
            movie,
            actors,
            moment,
           
        })
    })
      .catch(error => console.log(error))
  },
  update: function (req, res) {
    let {title, awards, rating, length, release_date, genre_id, actors} = req.body;
    actors = typeof actors === "string" ? [actors] : actors

      db.Movie.update(
        {
          title : title.trim(),
          awards,
          rating,
          release_date,
          length,
          genre_id,
          image : req.file ? req.file.filename : null
          
      },
      {
        where: {
          id: req.params.id
        }
      })
      .then(()=>{
        db.Actor_Movie.destroy({
          where: {
            movie_id : req.params.id
          }
        }).then(() => {
          if(actors){
          const actorsDB = actors.map(actor =>{
            return {
              movie_id : req.params.id,
              actor_id : actor
            }
          })
          db.Actor_Movie.bulkCreate(actorsDB,{
            validate : true
          }).then(() => console.log('Actores agregados correctamente'))
        }
        })
      })
      .catch(error => console.log(error))
      .finally(() => res.redirect('/movies'))
    
  },
  delete: function (req, res) {},
  destroy: function (req, res) {
    db.Actor_Movie.destroy({
      where:{
        movie_id: req.params.id
      }
    })
    .then(()=>{
      db.Actor.update(
      {
        favorite_movie_id : null
      },
      {
        where : {
          favorite_movie_id : req.params.id
        }
      }
      )
      .then(() => {
        db.Movie.destroy({
          where:{
            id: req.params.id
          }
        })
        .then(() => {
          return res.redirect('/movies')
        })
      })
    })
    .catch((error) => console.log(error))
  }
};

module.exports = moviesController;
