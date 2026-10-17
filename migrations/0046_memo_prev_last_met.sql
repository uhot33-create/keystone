-- 最後に会った日の一つ前。日付を変えたときだけ更新し、戻すときに入れ替える。
alter table memos add column if not exists prev_last_met_on date;
