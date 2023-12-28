const db = require('../database/models');
const moment = require('moment')
const {validationResult} = require('express-validator');
const paginate = require('express-paginate');
const axios = require('axios')
const { Op } = require('sequelize');
const API = 'http://www.omdbapi.com/?apikey=d1dcd02a';



//Aqui tienen una forma de llamar a cada uno de los modelos
// const {Movies,Genres,Actor} = require('../database/models');

//Aquí tienen otra forma de llamar a los modelos creados
const Movies = db.Movie;
const Genres = db.Genre;
const Actors = db.Actor;

const moviesController = {
list: (req, res) => {

    db.Movie.findAndCountAll({
        include: ['genre'],
        limit: req.query.limit,
        offset: req.skip
    })
        .then(({count,rows}) => {
            const pagesCount = Math.ceil(count / req.query.limit)
            const pages = paginate.getArrayPages(req)(pagesCount, pagesCount, req.query.page);

            res.render('moviesList', {
            movies : rows,
            pages: pages,
            paginate,
            pagesCount,
            currentPage : req.query.page,
            result : 0
        })
        })
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
  create: function (req,res) {
    const errors = validationResult(req);
    if(errors.isEmpty()){
        let {title, rating, release_date, awards, length, genre_id, actors} = req.body;
        actors = typeof actors === "string"? [actors] : actors;
        db.Movie.create({
            title:title.trim(), 
            rating, 
            release_date, 
            awards, 
            length,
            genre_id,
            image: req.file? req.file.filename :  null
        })
        .then(newMovie=>{
            if(actors){
                let actorDB = actors.map(actor => {
                    return {
                        movie_id: newMovie.id,
                        actor_id: actor
                    }
                })
                // return res.send(actorDB);
                db.Actor_Movie.bulkCreate(actorDB,{
                    validate: true
                })
                .then(()=>console.log('Actores agregados correctamente'))
            }
            console.log(newMovie)
            return res.redirect('/movies')
        })
        .catch(err => console.log(err))
    }else{
        // return res.send(errors)
        const actors = db.Actor.findAll();
        const genres = db.Genre.findAll({
            order: ['name']
        });
        Promise.all([actors, genres])
            .then(([actors, genres]) => {
                // return res.send(req.body)
                return res.render('moviesAdd',{
                    actors,
                    allGenres: genres,
                    errors: errors.mapped(),
                    old: req.body,
                })
            })
            .catch(error => console.log(error))
    }
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
  },
  search : (req,res) => {
    const keyword = req.query.keyword

    db.Movie.findAll({
      where: {
          title: {
              [Op.substring]: keyword
          }
      }
  }).then(movies => {
      if (!movies.length) {
          return axios.get(`${API}&t=${keyword}`)
              .then(movieApi => {
                  const movie = movieApi.data;
                  return res.render('moviesDetailOmdb', {
                      movie
                  });
              
        }).catch(error => console.log(error))
}
      const pages = paginate.getArrayPages(req)(1, 1, req.query.page);
      return res.render('moviesList',{
        movies ,
        result : 1,
        pages
      })
    }).catch(error => console.log(error))
  }
};

module.exports = moviesController;
