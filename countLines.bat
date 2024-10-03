@echo off
echo.
set /a totalLines=0
for %%a in (*.*) do call :countFileLines %%a
set totalLines="                 %totalLines%
echo -----------------------------------------
echo Total Lines:            %totalLines:~-17%
echo.
echo.
pause
goto :eof


:countFileLines
for /F %%c in ('type "%*" ^| find /c /v "AABBCC"') do set fileLines=%%c
for %%d in (%*) do set fileName="%%d                              "
set /a totalLines+=fileLines
set fileLines="          %fileLines%
echo %fileName:~1,30% %fileLines:~-10%
