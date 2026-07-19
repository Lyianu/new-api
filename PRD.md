# Cerberus Fork

## 第一版需求背景

我们需要基于newapi开发自己的分发平台，主要页面模仿OpenRouter进行。

## 功能

用户的前端：
- 主页面：模仿OpenRouter的https://openrouter.ai/settings/profile
- 模型：https://openrouter.ai/models?providers=Anthropic
- 使用记录：https://openrouter.ai/logs
- 充值：https://openrouter.ai/settings/credits

其中：充值我们使用stripe进行，允许用户自行设置金额，允许管理员设置起始金额
使用记录对于Claude模型（可配置），允许让用户选择是否记录上游响应包（由于市面上中转掺水泛滥，我们允许用户配置记录上游响应，可以将TLS响应保留5min（可配置），以便用户验证其签名来自Anthropic）。
模型与使用记录应该支持展示渠道。
充值的额度均为人民币计价，余额展示也为人民币计价，模型价格除了原有展示方式外，增加（x元/刀展示），并支持管理员为其配置折扣。
管理员需要支持配置用户的并发、RPM数量。

## 方法论

使用agent-browser查看网页了解功能、外观情况，给你创建了OpenRouter的账号密码：
账号：test@0az.net
密码：test@0az

这是个生产系统，涉及支付等功能，功能实现完成之后必须进行详尽的测试以保证质量。