const knex = require('knex')
const bcrypt = require('bcryptjs')
const app = require('../src/app')
const helpers = require('./test-helpers')

describe.only('Users Endpoints', function() {
    let db

    const { testUsers } = helpers.makeThingsFixtures()
    const testUser = testUsers[0]

    before('make knex instance', () => {
        db = knex({
            client: 'pg',
            connection: process.env.TEST_DB_URL,
        })
        app.set('db', db)
    })

    after('disconnect from db', () => db.destroy())

    before('cleanup', () => helpers.cleanTables(db))

    afterEach('cleanup', () => helpers.cleanTables(db))

    describe(`POST /api/users`, () => {
        context(`User Validation`, () => {
            beforeEach('insert users', () =>
                helpers.seedUsers(
                    db,
                    testUsers,
                )
            )

            const requiredFields = ['user_name', 'password', 'full_name']

            requiredFields.forEach(field => {
                const registerAttemptBody = {
                    user_name: 'test user_name',
                    password: 'test password',
                    full_name: 'test full_name',
                    nickname: 'test nickname',
                }

                it(`responds with 400 required error when '${field}' is missing`, () => {
                    delete registerAttemptBody[field]

                    return supertest(app)
                        .post('/api/users')
                        .send(registerAttemptBody)
                        .expect(400, {
                            error: `Missing '${field}' in request body`,
                        })
                })
            })

            it(`responds with 400 error when password is less than 8 characters`, () => {
                const userShortPassword = {
                    user_name: 'testing',
                    password: '123456r',
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userShortPassword)
                    .expect(400, { 
                        error: `Password must be longer than 8 characters`
                    })
            })
            it(`responds with 400 error when password is more than 72 characters`, () => {
                const userLongPassword = {
                    user_name: 'testing',
                    password: '*'.repeat(73),
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userLongPassword)
                    .expect(400, { 
                        error: `Password must be shorter than 72 characters`
                    })
            })
            it(`responds with 400 error when password starts with a space`, () => {
                const userPasswordStartSpace = {
                    user_name: 'testing',
                    password: ' aiU$$55n.',
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordStartSpace)
                    .expect(400, { 
                        error: `Password must not start or end with a space`
                    })
            })
            it(`responds with 400 error when password ends with a space`, () => {
                const userPasswordEndSpace = {
                    user_name: 'testing',
                    password: 'aiU$$55n. ',
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordEndSpace)
                    .expect(400, { 
                        error: `Password must not start or end with a space`
                    })
            })
            it(`responds with 400 error when password isn't complex`, () => {
                const userPasswordNotComplex = {
                    user_name: 'testing',
                    password: 'aaaaaAA2222',
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(userPasswordNotComplex)
                    .expect(400, { 
                        error: `Password must contain at least 1 uppercase, 1 lowercase, 1 number, and 1 special character`
                    })
            })
            it(`responds with 400 when user_name isn't unique`, () => {
                const usernameNotUnique = {
                    user_name: testUser.user_name,
                    password: 'aI8&hfakeuh',
                    full_name: 'another test',
                    nickname: 'whatsssup'
                }
                return supertest(app)
                    .post('/api/users')
                    .send(usernameNotUnique)
                    .expect(400, { 
                        error: `Username is already taken`
                    })
            })
        })
        context('Happy Path', () => {
            it('responds 201, serialized user, storing bcryped password', () => {
                const newUser = {
                    user_name: 'hey there',
                    password: 'aI8&hfakeuh',
                    full_name: 'another test',
                }
                return supertest(app)
                    .post('/api/users')
                    .send(newUser)
                    .expect(res => {
                        expect(res.body).to.have.property('id')
                        expect(res.body.user_name).to.eql(newUser.user_name)
                        expect(res.body.full_name).to.eql(newUser.full_name)
                        expect(res.body.nickname).to.eql('')
                        expect(res.body).to.not.have.property('password')
                        expect(res.headers.location).to.eql(`/api/users/${res.body.id}`)
                        const expectedDate = new Date().toLocaleString('en', {timeZone: 'UTC'})
                        const actualDate = new Date(res.body.date_created).toLocaleString()
                        expect(actualDate).to.eql(expectedDate)
                    })
                    .expect(res => 
                        db
                            .from('thingful_users')
                            .select('*')
                            .where({ id: res.body.id })   
                            .first()
                            .then(row => {
                                expect(row.user_name).to.eql(newUser.user_name)
                                expect(row.full_name).to.eql(newUser.full_name)
                                expect(row.nickname).to.eql(null)
                                const expectedDate = new Date().toLocaleString('en', {timeZone: 'UTC'})
                                const actualDate = new Date(row.date_created).toLocaleString()
                                expect(actualDate).to.eql(expectedDate)

                                return bcrypt.compare(newUser.password, row.password)
                            }) 
                            .then(compareResult => {
                                expect(compareResult).to.be.true
                            })
                    )
            })
            
        })
    })
})