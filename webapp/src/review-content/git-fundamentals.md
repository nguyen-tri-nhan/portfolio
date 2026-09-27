---
key: "Git Fundamentals"
title: "Git Fundamentals: Mô Hình, Lệnh Hằng Ngày & Cứu Dữ Liệu"
crumb: "16. Linux & Deployment › Git"
---

Git là công cụ dùng mỗi ngày nhưng nhiều người chỉ thuộc `add`, `commit`, `push` và hoảng loạn khi gặp conflict hay lỡ `reset`. Nắm mô hình dữ liệu bên dưới (snapshot, con trỏ, 3 vùng) thì mọi lệnh trở nên dễ đoán, và hầu như không có thao tác nào làm mất commit không cứu được.

## Điểm Chính

- **3 vùng làm việc**:
  - **Working tree** — file bạn đang sửa.
  - **Index (staging area)** — snapshot sẽ vào commit tiếp theo (`git add` đưa thay đổi vào đây).
  - **Repository** (`.git`) — lịch sử commit.
- **Commit là snapshot**, không phải diff: mỗi commit trỏ tới một cây thư mục (tree) đầy đủ và tới commit cha. Mọi object (blob, tree, commit, tag) được định danh bằng hash nội dung.
- **Branch chỉ là con trỏ** tới một commit — tạo branch gần như không tốn gì. `HEAD` trỏ tới branch hiện tại (hoặc thẳng tới commit khi *detached HEAD*).
- **Remote-tracking branch** (`origin/main`) là bản ghi vị trí branch trên remote ở lần `fetch` gần nhất. `git fetch` chỉ tải về và cập nhật những con trỏ này; `git pull` = `fetch` + `merge` (hoặc `rebase` nếu cấu hình `pull.rebase=true`).
- **Hoàn tác**:
  - `git restore <file>` — bỏ thay đổi chưa stage ở working tree.
  - `git restore --staged <file>` — bỏ khỏi index, giữ thay đổi.
  - `git reset --soft|--mixed|--hard <commit>` — dời branch về commit khác; khác nhau ở chỗ có đụng tới index/working tree không.
  - `git revert <commit>` — tạo commit mới đảo ngược thay đổi; **an toàn cho branch đã push** vì không viết lại lịch sử.
- **Reflog** ghi lại mọi lần `HEAD`/branch di chuyển trong repo local. Mặc định giữ 90 ngày (entry không còn reachable: 30 ngày). Đây là "lưới an toàn" sau `reset --hard`, rebase hỏng, xóa nhầm branch.
- `git switch` / `git restore` (Git 2.23) tách hai vai trò của `git checkout` cũ (đổi branch / khôi phục file) cho rõ ràng hơn.

## Ví Dụ Code

*Luồng hằng ngày*

```bash
git switch main && git pull              # cập nhật main
git switch -c feature/order-export       # tạo và chuyển sang branch mới

git status                               # xem thay đổi ở từng vùng
git diff                                 # working tree vs index (chưa stage)
git diff --staged                        # index vs commit cuối (sắp commit)

git add -p                               # stage từng đoạn — tránh commit nhầm debug code
git commit -m "feat(order): export orders to CSV"
git push -u origin feature/order-export  # -u: thiết lập upstream cho lần push/pull sau
```

*reset --soft / --mixed / --hard*

```bash
# Giả sử lịch sử: A — B — C (HEAD, main)

git reset --soft  B   # main → B; thay đổi của C vẫn ở index (đã stage) → commit lại gộp được
git reset --mixed B   # (mặc định) main → B; thay đổi của C ở working tree, chưa stage
git reset --hard  B   # main → B; XÓA thay đổi của C khỏi index và working tree
                      # (commit C vẫn còn trong reflog — xem phần cứu bên dưới)

# Đã push lên branch dùng chung? Không reset, dùng revert:
git revert C          # tạo commit C' đảo ngược C, lịch sử cũ giữ nguyên
```

*Cứu dữ liệu bằng reflog*

```bash
git reset --hard HEAD~3        # lỡ tay xóa 3 commit

git reflog
# a1b2c3d HEAD@{0}: reset: moving to HEAD~3
# 9f8e7d6 HEAD@{1}: commit: add CSV header      ← trạng thái trước khi reset
# ...

git reset --hard 9f8e7d6       # hoặc: git reset --hard HEAD@{1}

# Lỡ xóa branch chưa merge
git branch -D feature/x        # in ra: Deleted branch feature/x (was 4e5f6a7)
git branch feature/x 4e5f6a7   # tạo lại từ hash (hoặc tìm trong git reflog)
```

*Stash — tạm cất thay đổi dở dang*

```bash
git stash push -m "wip: export filter"   # cất thay đổi đã track
git stash push -u                        # -u: cất cả file chưa track
git switch hotfix/login                  # sửa việc gấp
git switch -                             # quay lại branch trước
git stash list
git stash pop                            # lấy ra và xóa khỏi stash (conflict thì stash được giữ lại)
```

*Commit nhầm branch*

```bash
# Đã commit lên main nhưng lẽ ra phải ở branch mới (chưa push)
git branch feature/fix-typo      # branch mới trỏ vào commit hiện tại
git reset --hard origin/main     # đưa main về như trên remote
git switch feature/fix-typo
```

*Tìm commit gây bug bằng bisect*

```bash
git bisect start
git bisect bad                   # commit hiện tại có bug
git bisect good v1.4.0           # tag cuối cùng còn chạy đúng
# Git checkout commit ở giữa → bạn test → đánh dấu good/bad → lặp lại (tìm nhị phân)
git bisect run ./mvnw -q test -Dtest=OrderExportTest   # hoặc tự động bằng script trả exit code
git bisect reset
```

*.gitignore và file đã lỡ commit*

```bash
echo ".env" >> .gitignore
git rm --cached .env             # ngừng track nhưng giữ file local
git commit -m "chore: stop tracking .env"
# Lưu ý: secret đã nằm trong lịch sử — phải thu hồi/đổi secret đó, xóa khỏi file thôi là chưa đủ
```

## Ứng Dụng Thực Tế

**Commit message**: dòng đầu ngắn (≤ ~50 ký tự), mô tả *việc commit làm* ở dạng mệnh lệnh; phần thân giải thích *tại sao*. Nhiều team dùng Conventional Commits (`feat:`, `fix:`, `chore:`...) để sinh changelog và quyết định bump version tự động.

**Commit nhỏ, một ý**: dễ review, dễ `revert`, `bisect` chỉ ra đúng thay đổi gây lỗi. Tránh commit "WIP" lẫn lộn format code với thay đổi logic.

**Bảo vệ branch chính**: trên GitHub/GitLab bật branch protection cho `main` — bắt buộc qua pull request, CI xanh, ít nhất một reviewer, cấm force push.

**Secret lỡ push**: coi như đã lộ — thu hồi và tạo lại ngay. Viết lại lịch sử (`git filter-repo`) chỉ là bước dọn dẹp sau đó, vì bản clone/fork/cache có thể đã có secret.

## Câu Hỏi Phỏng Vấn

<details>
<summary><strong>git fetch và git pull khác nhau thế nào?</strong></summary>

**A:** `git fetch` tải commit mới từ remote và cập nhật remote-tracking branch (`origin/main`), không đụng vào branch local hay working tree — an toàn để chạy bất cứ lúc nào, sau đó xem `git log main..origin/main` rồi mới quyết định tích hợp. `git pull` = `fetch` + tích hợp vào branch hiện tại bằng `merge` (mặc định) hoặc `rebase` (`git pull --rebase` hay `pull.rebase=true`), có thể phát sinh conflict hoặc merge commit.

</details>

<details>
<summary><strong>Phân biệt reset --soft, --mixed, --hard và revert.</strong></summary>

**A:** Cả ba kiểu `reset` đều dời con trỏ branch hiện tại về commit chỉ định. `--soft`: giữ nguyên index và working tree (thay đổi thành "đã stage"). `--mixed` (mặc định): reset cả index, thay đổi còn trong working tree ở trạng thái chưa stage. `--hard`: reset cả index và working tree — thay đổi chưa commit mất hẳn. `reset` viết lại lịch sử nên chỉ dùng trên commit chưa push. `revert` thì tạo commit mới có nội dung đảo ngược, không đổi lịch sử cũ → cách đúng để hoàn tác trên branch dùng chung.

</details>

<details>
<summary><strong>Lỡ reset --hard mất commit, có lấy lại được không?</strong></summary>

**A:** Có, nếu thay đổi đã từng được commit. `git reflog` liệt kê các vị trí HEAD từng đi qua; tìm hash trước khi reset rồi `git reset --hard <hash>` hoặc tạo branch từ hash đó. Commit không còn reachable vẫn nằm trong repo cho đến khi reflog hết hạn (mặc định 30 ngày với entry unreachable) và `git gc` dọn. Thay đổi **chưa từng commit** (chưa add) thì `reset --hard` xóa thật; nếu đã `add` thì blob còn trong object store, có thể tìm bằng `git fsck --lost-found`.

</details>

<details>
<summary><strong>Detached HEAD là gì, có nguy hiểm không?</strong></summary>

**A:** HEAD trỏ trực tiếp vào một commit thay vì vào branch — xảy ra khi checkout một tag, một hash, hoặc giữa lúc rebase/bisect. Xem code thì không sao. Nếu commit mới ở trạng thái này rồi chuyển đi branch khác, các commit đó không thuộc branch nào và sẽ bị dọn sau khi reflog hết hạn. Cách giữ: `git switch -c <tên-branch>` ngay tại đó (hoặc tìm lại hash qua reflog).

</details>

<details>
<summary><strong>Branch trong Git là gì? Tại sao tạo branch rẻ?</strong></summary>

**A:** Branch chỉ là một file nhỏ chứa hash của commit mà nó trỏ tới (con trỏ di động). Tạo branch = ghi thêm một con trỏ, không copy file nào. Khi commit, con trỏ của branch hiện tại tiến tới commit mới. Vì vậy Git khuyến khích tạo branch cho mỗi feature/bugfix và xóa sau khi merge.

</details>
