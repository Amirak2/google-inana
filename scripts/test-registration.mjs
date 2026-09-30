import assert from 'node:assert/strict';
import { createAuthStore } from '../server/authStore.ts';
const buckets=new Map();
const store={
  map(k){if(!buckets.has(k))buckets.set(k,new Map());return buckets.get(k);},
  get(k,id){return this.map(k).get(id);},
  set(k,id,v){this.map(k).set(id,v);},
  replaceMap(k,v){buckets.set(k,v);},
  tokenSet(k){return {has:id=>this.map(k).has(id),add:id=>this.map(k).set(id,{})};},
};
const auth=createAuthStore(store,{SESSION_SECRET:'local-test-secret-'.repeat(3)});
const mobile='09120000123';
const credentials={username:'New.Customer',password:'Registration-test-password'};
function otp(phone){store.map('otp').set(phone,{mobile:phone,code:'12345',attempts:0,expiresAt:Date.now()+180000,createdAt:Date.now()});}
otp(mobile);
assert.throws(()=>auth.verifySmsOtpAndAuthenticate(mobile,'54321','Test',credentials),/اشتباه/);
assert.equal(auth.findUserByMobile(mobile),undefined);
assert.throws(()=>auth.verifySmsOtpAndAuthenticate(mobile,'12345','Test'),/نام کاربری/);
assert.ok(store.map('otp').has(mobile));
const registered=auth.verifySmsOtpAndAuthenticate(mobile,'12345','Test',credentials);
assert.equal(registered.isNewUser,true);
assert.equal(registered.user.username,'new.customer');
assert.equal(auth.findUserByMobile(mobile).phoneVerified,true);
assert.equal(registered.user.passwordHash,undefined);
assert.equal(auth.loginWithUsername('NEW.CUSTOMER',credentials.password).user.uid,registered.user.uid);
assert.throws(()=>auth.loginWithUsername(credentials.username,'wrong'),/نادرست/);
const next='09120000124';otp(next);
assert.throws(()=>auth.verifySmsOtpAndAuthenticate(next,'12345','Test',credentials),/قبلاً/);
assert.equal(auth.findUserByMobile(next),undefined);
assert.ok(store.map('otp').has(next));
const boundaryMobile='09120000125';otp(boundaryMobile);
assert.throws(()=>auth.verifySmsOtpAndAuthenticate(boundaryMobile,'12345','Test',{username:'boundary_user',password:'Abc123!'}),/۸/);
assert.ok(store.map('otp').has(boundaryMobile));
const boundaryUser=auth.verifySmsOtpAndAuthenticate(boundaryMobile,'12345','Test',{username:'boundary_user',password:'Abc123!x'});
assert.equal(auth.loginWithUsername('boundary_user','Abc123!x').user.uid,boundaryUser.user.uid);
otp(boundaryMobile);
assert.throws(()=>auth.setPasswordCredentials(boundaryUser.user.uid,'boundary_user','Abc123!','12345'),/۸/);
auth.setPasswordCredentials(boundaryUser.user.uid,'boundary_user','New123!x','12345');
assert.equal(auth.loginWithUsername('boundary_user','New123!x').user.uid,boundaryUser.user.uid);
otp(mobile);
auth.verifySmsOtpAndAuthenticate(mobile,'12345','Test',{username:'hijack',password:'Attempt-to-replace-password'});
assert.equal(auth.loginWithUsername(credentials.username,credentials.password).user.uid,registered.user.uid);
assert.throws(()=>auth.loginWithUsername('hijack','Attempt-to-replace-password'),/نادرست/);
console.log('Registration: OTP required, credentials required, unique username, hashed password and existing-account protection passed');
