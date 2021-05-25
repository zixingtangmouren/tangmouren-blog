## 前言

这几在看 Vue 的源码与其相关的博客，看到了关于**Vue 异步更新策略**和**nextTick**的诸多文章，奈何功力不够深厚，看的是有点蒙蔽。主要原因是这些个模块，需要对 JS 的一些运行机制和`Event Loop`（事件循环）有一定的了解，于是决定再一次深入的去了解这些知识。

在后来几天的学习中，当下就是总结了这几个蒙蔽点（你可先尝试自我回答一下）：

- JS 作为一个单线程语言，是如何实现并发的执行（定时器，http 请求）任务的？
- 什么是主线程/`call stack`（执行栈）？
- 什么是`task queue`（任务队列）？
- 什么是(`task/macrotask`)宏/(`microtask`)微事件？
- 所谓的事件循环，在浏览器运行层面来说，究竟是什么？
- 每次事件循环，都干了什么事情？

当时在学习的过程中，我就如下图这样的感觉：

![](https://user-gold-cdn.xitu.io/2020/4/30/171c91e73c1c9322?w=300&h=300&f=jpeg&s=8984)

带着上面这些个问题，于是开始这几天的展开式的学习，从`Event Loop`的概念，在到浏览器层面的实际运行原理。

> 本篇参考诸多文章，借鉴了里面的很多原话，都在文章的末尾都一一列出了。

## 渲染进程

我猜大部分做前端的，都知道`Event Loop`（事件循环）的概念。但是很多人，对它的了解非常的片面。要想知道这个概念究竟是什么，就要浏览器是如何运行的说起。

首先，浏览器是**多进程执行**的，但是对于我们研究最重要的，就是浏览器多个进程中的**渲染进程**，在浏览器的运行中，每一个页面都有独立渲染进程。这个**进程**分别由如下几个**线程**在工作:

- GUI 渲染线程
- JS 引擎线程
- 事件触发线程
- 定时器触发线程
- 异步 http 请求线程

> 上面这几个线程，保证我们整个页面（应用）的完整运行。

### JS 引擎线程

JS 引擎线程负责解析 Javascript 脚本，运行代码，V8 引擎就是在这个线程上运行的。

- **这条线程，也就是在事件循环中，咱们常说的主线程和`call stack`（执行栈）。所有的任务（函数），最终都会进入这里来执行。**
- 只要执行栈空了，它就会不断的去访问`task queue`（任务队列）,一旦任务队列中有可以执行的函数，就会压入栈内执行。
- **一个 Tab 页(renderer 进程)中无论什么时候都只有一个 JS 线程在运行 JS 程的，所有 JS 是单线程的**

现在出现了两个词：`call stack`（执行栈）,`task queue`（任务队列），这里先来解释一下，什么是执行栈。

#### call stack（执行栈）

栈是一个先进后出的数据结构，所有的函数都会逐一的进入到这里面执行，一旦执行完毕就会退出这个栈。

```js
function fun3() {
  console.log('run')
  throw Error('err')
}

function fun2() {
  fun3()
}

function fun1() {
  fun2()
}

fun1()
```

这里我特意在`fun3`抛出了一个异常，我们来看一下浏览器的输出：

![](https://user-gold-cdn.xitu.io/2020/4/30/171c9ed2bbe96f94?w=388&h=87&f=png&s=2801)

上面这列出来的一个个函数，就是一个执行栈。这里我用一个更详细的图解来表示一下执行栈的运行过程：

![](https://user-gold-cdn.xitu.io/2020/4/30/171ca0c8ff032538?w=1008&h=394&f=png&s=23825)

上面这个图解，是对执行栈运行过程的分布演示。这个执行栈，就是我们 JS 真正运行的地方，函数的调用会在这里形成一个调用栈，在里面是一个个执行的，必须得等到栈顶的函数执行完毕退出，才能继续执行下面的函数。一旦这个栈为空，它就会去`task queue`（任务队列）看有没有待执行的任务（函数）。

那么我们常说的任务队列，究竟又是一个啥玩意呢？

### 事件触发线程

**首先，这里还要强调一下上面的提到的，一个页面的运行，是需要多个线程配合支持的。**

咱们常说的任务队列，就是由这个事件触发线程来维护的。当时，我看到这个就蒙蔽了……尼玛，JS 不是单线程吗？这条事件触发线程是怎么回事？

**JS 的确是还是单线程执行的。这个事件触发线程属于浏览器而不是 JS 引擎，这是用来控制事件循环，并且管理着一个任务队列(task queue)，然而对本身的 JS 程序，没有任何控制权限，最终任务队列里的函数，还是得交回执行栈去执行。**

#### task queue（任务队列）

那么这个线程维护的这个`task queue`究竟是干嘛的呢？

上面在说`call stack`（执行栈）的时候，咱们提到了，一旦执行栈里面被清空了，它就会来看任务队列中是否有需要执行的任务（函数）。这个任务队列可能存放着延期执行的回调函数，类似`setTimeout`,`setInterval`（并不是说 setTimeout 和 setInterval 在这里面，而是他们的回调函数），还可能存放着 Ajax 请求结果的回调函数等等。

这里先看下具体代码：

```js
console.log('1')

setTimeout(() => {
  console.log('2')
}, 1000)

$.ajax(/*.....*/)
```

现在我们来图解一下，整个运行过程（图画的比较丑，别建议）：

- 第一步，console.log 方法进入执行栈，执行完毕后退出。

![](https://user-gold-cdn.xitu.io/2020/4/30/171ca30baec9f37e?w=950&h=649&f=png&s=35482)

- 第二步，执行 setTimeout 方法。大家知道延迟，是需要去读数的（你可以理解为计时），当到了时间，就让回调进入到任务队列里面，去等待执行。然而，这个读数的工作是谁在做呢？首先肯定不是 JS 引擎线程在做，因为执行栈一次只能执行一个任务，如果在执行栈中去读数，必然会造成阻塞，所以渲染进程中，有专门的**定时器触发线程**来负责读数，到了时间，就把回调交给任务队列。

![](https://user-gold-cdn.xitu.io/2020/4/30/171ca46f9a3df5c4?w=958&h=930&f=png&s=62565)

- 第三步，发起 Ajax 请求，请求的过程也是在其他线程并行执行（**http 请求线程**）的，请求有了结果以后，回调函数加入事件触发线程的任务队列。

![](https://user-gold-cdn.xitu.io/2020/4/30/171ca5a7a35fa24c?w=985&h=648&f=png&s=44300)

![](https://user-gold-cdn.xitu.io/2020/4/30/171ca60ad1259e65?w=957&h=653&f=png&s=40690)

所以，现在应该明白`call stack`（执行栈），`task queue`（任务队列）是怎么一个工作状态了吧。这里说一句不专业的话，但是你可以这么去理解：

> 在浏览器环境下的 JS 程序运行中，其实并不是单线程去完成所有任务的，如定时器的读数，http 的请求，都是交给其他线程去完成，这样才能保证 JS 线程不阻塞。

### 定时器触发线程

上面我们提到在执行`setTimeout`和`setInterval`的时候，如果让 JS 引擎线程去读数的话，必然会造成阻塞。这也是不符合实际需求的，所以这件读数的事情，浏览器把它交给了渲染进程中的定时器触发线程。

一旦，代码中出现`timer`类型 API，就会交给这个线程去执行，这样 JS 引擎线程，就可以继续干别的事情。等到时间一到，这个线程就会将对应的回调，交给事件触发线程所维护的`task queue`（任务队列）并加入其**队尾**，一旦执行栈为空，就会拿出来执行。

但是这里要提一点，就算执行栈为空也不一定能马上执行这个回调，因为`task queue`（任务队列）中可能还有很多的待执行函数，所以定时器只能让它到了时间的加入到`task queue`中，但不一定能够准时的执行。

### 异步 http 请求线程

这个线程就是专门负责 http 请求工作的。简单说就是当执行到一个 http 异步请求时，就把异步请求事件添加到异步请求线程，等收到响应(准确来说应该是 http 状态变化)，再把回调函数添加到任务队列，等待 js 引擎线程来执行。

### GUI 渲染线程

这个线程要重点说一下。首先这个 GUI 渲染线程和 JS 引擎线程是互斥的，说白了就是这两个同一时间，只能有一个在运行，JS 引擎线程会阻塞 GUI 渲染线程,这也是为什么 JS 执行时间长了，会导致页面渲染不连贯的原因。

- 负责渲染浏览器界面，解析 HTML，CSS，构建 DOM 树和 Rendert 树
- JS 负责操作 DOM 对象，GUI 负责渲染 DOM（最耗费性能的地方），GUI 线程会在每次循环中，合并所有的 UI 修改，也是浏览器对渲染的性能优化。
- GUI 更新会被保存在一个队列中等到 JS 引擎空闲时立即被执行。

### 小结

通过上面的这些理论，脑海里应该大致知道浏览器层面的 JS 是如何去工作了的吧。现在应该可以回答一开上面提出的部分问题了：

- JS 作为一个单线程语言，是如何实现并发的执行（定时器，http 请求）任务的？**答案：因为浏览器提供了定时器触发线程和异步 Http 请求线程，来分担这些会造成主线程阻塞的工作。**
- 什么是主线程/`call stack`（执行栈）？**答案：执行栈是 JS 引擎线程（主线程）中的一个先进后出执行 JS 程序的地方。一次只允许一个函数在执行，一旦栈被清空，将会轮询任务队列，将任务队列中的函数逐一压如栈内执行**
- 什么是`task queue`（任务队列）？**答案：任务队列是在事件触发线程中，一个存放异步事件回调的地方。当定时器任务，异步请求任务在其他线程执行完毕时，就会将加入队列的队尾，然后被执行栈逐一执行。**

OK，现在已经解决三个问题，接下来我们继续解决剩下的三个问题。这个三个问题，就是从 JS 事件循环机制的角度来研究了。

## Event Loop（事件循环）

我相信大部分搞前端的，都应该知道这玩意。但是，我发现并不是每个人都能说清楚这个东西。彻底了解这个，对于我们处理开发中许多异步问题和阅读源码，是很多有帮助的。

首先，我们先开看一张图（此图出自于[Event Loop 的规范和实现](https://juejin.im/post/6844903552402325511)）：

![](https://user-gold-cdn.xitu.io/2020/5/1/171d0073fcb8c72d?w=585&h=357&f=webp&s=15320)

我觉得如果你看完了上面渲染进程相关知识，在看这个图，应该是能理解百分之 70 了吧，剩下百分之是因为里面出现了`microtask queue`（微任务队列）和`Promise`,`mutation observer`的相关字眼。

我觉得，在开始了解`Event Loop`之前，有必要提出两个问题：

- 为什么要有`Event Loop`？
- `Event Loop`的每一个循环，干了些什么事？

### 宏/微任务

针对上面给出这个图出现的一个新词`microtask`，来展开进行学习。

首先，先来看一段代码：

```js
setTimeout(() => {
  console.log(1)
})

Promise.resolve().then(() => {
  console.log(2)
})

console.log(3)
```

输出的结果：`3,2,1`

在还没有接触的`Event Loop`之前，看到这个结果的时候，说实话，我是很懵逼的。

![](https://user-gold-cdn.xitu.io/2020/5/1/171d0268e54b062b?w=820&h=820&f=jpeg&s=82099)

OK，到这里，我们需要先知道两个概念：`task`（任务），`microtask`（微任务）；

> 这里提一点，网上很多博客说到了一个`macrotask`（宏任务）其实跟这个`task`（任务）是一个东西。你可以参考换一下 HTML5 规范的文档，里面甚至没有`macrotask`这个词，“宏”这个概念，只是为了更好区分任务和微任务的关系。

通过仔细阅读文档得知，这两个概念属于对异步任务的分类，不同的 API 注册的异步任务会依次进入自身对应的队列中，然后等待 Event Loop 将它们依次压入执行栈中执行。

**task 主要包含**：`主代码`、`setTimeout`、`setInterval`、`setImmediate`、`I/O`、`UI交互事件`

**microtask 主要包含**：`Promise`、`process.nextTick`、`MutaionObserver`

> 这里提一点：Promise 的 then 方法，会将传入的回调函数，加入到`microtask queue`中。

**然后接下来，你需要知道`Event Loop`的每个循环的流程：**

- 执行一次最旧的 task
- 然后检测`microtask`（微任务），直到所有微任务清空为止
- 执行 UI render（JS 引擎线程被挂起等待，GUI 渲染线程开始运行）

现在带着渲染进程的知识，结合这个流程，来捋一遍上面代码：

1. 第一轮循环，主代码是一个`task`，于是它进入 JS 引擎线程中的执行栈开始执行。
2. `setTimeout`方法被调用，也进入执行栈，将一个延时的异步事件交给了定时器触发线程去读数，然后它马上退出执行栈。
3. `Promise.resolve()`进入执行栈，返回一个`Promise`，退出执行栈。
4. `then()`方法进入执行栈，将一个函数加入了`microtask queue`（微任务队列），退出执行栈。
5. `console.log(3)`进入执行栈，输出 3，退出执行栈。
6. 此时，主代码已经执行完毕，第一个`task`,退出执行栈。
7. 然后，执行栈去看`microtask queue`，发现一个`()=>{ console.log(2) }`函数，压入执行栈，输出 2，退出执行栈。
8. 此时，`microtask queue`被清空，切到 GUI 线程，看是有需要变动 UI 的，第一轮循环完毕。
9. 第二轮循环。在第一轮循环的代码执行中，`setTimeout`发起的定时器是在定时器触发线程并发进行，读数完毕，回调交给事件触发线程中的`task queue`。所以，此时任务队列中有一个待执行的`task`。
10. 执行栈将这个`task`压入执行栈执行，输出 1，然后退出执行栈。
11. 整个`Event Loop`，继续重复上面的流程执行。

`Event Loop`的不断循环，保证了我们的 JS 代码同步和异步代码的有序执行。

现在回答一下上面提出的两个问题：

1.  因为 Javascript 设计之初就是一门单线程语言，因此为了实现主线程的不阻塞，Event Loop 这样的方案应运而生。
2.  `task`=>`microtask`=>`GUI`

#### 重点说一下`microtask`（微任务）

ES6 新引入了 Promise 标准，同时浏览器实现上多了一个 microtask 微任务概念。在浏览器上，**主要**有两个微任务 API：

- `Promise.then`
- `mutation observer`

第一个大家应该都熟悉，第二个呢，我之前也不知道，是后来再看 Vue 的 nextTick 源码中看到的，有兴趣的同学可以去了解一下这个 API。

这里主要说一下微任务和宏任务的不同点，和相同点。

不同点：

- 宏任务：
  - 异步的任务是需要在其他线程上去执行的，主要是为了保证主线程不阻塞。
  - 宏任务的回调函数，是先保存在任务队列中的，也就是事件触发线程上。
  - 一次循环，只执行一个`task`
- 微任务：

  - 微任务它不是异步任务，它会直接将回调函数加入`microtask queue`（微任务队列）。
  - 每次前一个`task`执行完毕，然后所有的`microtask`都要被执行完。

相同点：

1. 他们的回调函数，都不会本轮循环中立即执行。
2. 没有回调函数，它们都将失去意义。

现在再来把最开始提出的后三个问题回顾一下，应该有一个大致的概念了吧。

## 最后

其实本来是想写，结合 Event Loop 来理解 Vue 的异步批量更新以及 nextTcik 的，但是后面发现 Event Loop 这块写的太多了，于是就分开写了。。。

但是，我相信你看完上面的全部内容，在面试的时候，或者碰到异步相关问题的时候，都应该能够应付了。其实这个`Event Loop`中还有一些用户交互事件没详细讲到，有兴趣的可以自行研究一下。

> Tips:如果有错误或者有歧义的地方，可以在直接指出。

本篇参考的资料：

[「硬核 JS」一次搞懂 JS 运行机制](https://juejin.im/post/6844904050543034376#heading-20)（这篇博客中，说到关于浏览器进程和线程的知识，讲解的非常详细，同时对 Event Loop 也是总结的非常好）

[Event Loop 的规范和实现](https://juejin.im/post/6844903552402325511)（这个主要讲 Event Loop，也是非常的通俗易懂，里面的许多案例值得参考）