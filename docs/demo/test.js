/**
 * @Author: tangzhicheng
 * @Date: 2021-05-13 09:37:47
 * @LastEditors: tangzhicheng
 * @LastEditTime: 2021-05-13 09:40:01
 * @Description: file content
 */


const obj = {
  a: 1,
  person: {
    age: 18
  }
}

const p = new Proxy(obj, {
  get: function (target, key, receiver) {
    const res = Reflect.get(target, key, receiver)
    console.log(key)
    return res
  },
  set: function (target, key, value, receiver) {
    const res = Reflect.set(target, key, value, receiver)
    return res
  }
})

p.a

p.person.age