import _ from 'lodash';
import assert from 'assert';
import async from 'async';
import fakePassport from './fake-passport';
import mongo from '../lib/db/mongo';
import proxyquire from 'proxyquire';
import request from 'request';

const server = proxyquire('../lib/server', { passport: fakePassport });

// import d from 'debug';
// const debug = d('plant:test.helper');

export function getUrl(url) {
  if(_.startsWith(url, 'http')) {
    return url;
  }

  return `http://127.0.0.1:3001${url}`;
}

let jwt;
export function makeRequest(opts, cb) {

  const auth = opts.authenticate
    ? {Authorization: 'Bearer ' + jwt }
    : {};

  const headers = {
    ...(opts.headers || {}),
    ...auth
  };

  const followRedirect = opts.followRedirect || false;

  const options = {
    ...opts,
    url: getUrl(opts.url),
    headers,
    followRedirect
  };

  // debug('options:', options);

  // cb will get (error, httpMsg, response);
  request(options, cb);
}

const data = {};
export function startServerAuthenticated(done) {
  if(data.app) {
    return done(null, data);
  }

  server.default((err, application) => {
    assert(!err);

    data.app = application;

    makeRequest({
      url: '/auth/facebook/callback'
    }, (error, httpMsg) => {
      assert(!error);
      assert(httpMsg.headers);
      assert(httpMsg.headers.location);
      const parts = httpMsg.headers.location.split('=');
      jwt = parts[1];
      // debug('Test jwt:', jwt);
      assert(jwt);
      data.userId = fakePassport.getUserId();
      return done(error, data);
    });
  });
};

export function deleteAllPlantsForUser(cb) {
  mongo.deleteAllPlantsByUserId(data.userId, cb);
}

export function createPlants(numPlants, userId, cb) {
  const plantTemplate = {
    title: 'Plant Title',
    userId
  };

  var createPlant = function(count, callback) {
    const reqOptions = {
      method: 'POST',
      authenticate: true,
      body: {...plantTemplate, title: `${plantTemplate.title} ${count}`},
      json: true,
      url: '/api/plant'
    };

    makeRequest(reqOptions, (error, httpMsg, plant) => {
      assert(!error);
      assert.equal(httpMsg.statusCode, 200);

      assert(plant.title);

      callback(null, plant);
    });
  };

  // generate some plants
  async.times(numPlants, (n, next) => {
    createPlant(n, next);
  }, function(err, plants) {
    assert(!err);
    // we should now have 'numPlants' plants
    // debug('async.times:', plants);
    assert.equal(plants.length, numPlants);

    cb(err, plants);
  });

}

export function createNote(plantIds, noteOverride = {}, cb) {
  assert(_.isArray(plantIds));
  const noteTemplate = {
    note: 'This is a note',
    date: new Date(),
    plantIds,
    ...noteOverride
  };

  const reqOptions = {
    method: 'POST',
    authenticate: true,
    body: noteTemplate,
    json: true,
    url: '/api/note'
  };

  makeRequest(reqOptions, (error, httpMsg, response) => {
    assert(!error);
    assert.equal(httpMsg.statusCode, 200);
    assert(response._id);

    cb(null, response);
  });


}
