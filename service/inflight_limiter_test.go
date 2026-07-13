package service

import "testing"

// limit<=0 表示不限。
func TestAcquireInflight_Unlimited(t *testing.T) {
	for i := 0; i < 100; i++ {
		ok, release := AcquireInflight("u:unlimited", 0)
		if !ok {
			t.Fatalf("unlimited should always acquire")
		}
		release()
	}
}

// 达到并发上限后拒绝；释放后可再次占用。
func TestAcquireInflight_LimitAndRelease(t *testing.T) {
	key := "u:limit-test"
	ok1, rel1 := AcquireInflight(key, 2)
	ok2, rel2 := AcquireInflight(key, 2)
	if !ok1 || !ok2 {
		t.Fatalf("first two acquires should succeed")
	}
	ok3, _ := AcquireInflight(key, 2)
	if ok3 {
		t.Fatalf("third acquire should be rejected at limit 2")
	}
	// 释放一个后应可再占用
	rel1()
	ok4, rel4 := AcquireInflight(key, 2)
	if !ok4 {
		t.Fatalf("acquire after release should succeed")
	}
	rel2()
	rel4()
	// 全部释放后应回到可占满状态
	okA, relA := AcquireInflight(key, 2)
	okB, relB := AcquireInflight(key, 2)
	if !okA || !okB {
		t.Fatalf("after full release should acquire up to limit again")
	}
	relA()
	relB()
}

// 不同 key 相互独立。
func TestAcquireInflight_KeyIsolation(t *testing.T) {
	okA, relA := AcquireInflight("u:iso-a", 1)
	okB, relB := AcquireInflight("u:iso-b", 1)
	if !okA || !okB {
		t.Fatalf("different keys should not interfere")
	}
	relA()
	relB()
}

// RPM：limit<=0 不限；达到上限后拒绝。
func TestAllowRpm(t *testing.T) {
	if !AllowRpm("u:rpm-unlimited", 0) {
		t.Fatalf("rpm limit<=0 should always allow")
	}
	key := "u:rpm-test-unique"
	for i := 0; i < 3; i++ {
		if !AllowRpm(key, 3) {
			t.Fatalf("request %d within limit 3 should be allowed", i+1)
		}
	}
	if AllowRpm(key, 3) {
		t.Fatalf("4th request should exceed rpm limit 3")
	}
}
